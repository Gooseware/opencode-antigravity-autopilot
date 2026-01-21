#!/usr/bin/env node

import { HardLimitDetector } from '../dist/rotation/HardLimitDetector.js';

async function testHardLimitDetection() {
  console.log('=== Testing Hard Limit Detection ===\n');

  const detector = new HardLimitDetector({
    quotaThreshold: 0.2,
    preferredModels: [
      'google/antigravity-gemini-3-pro',
      'google/antigravity-claude-sonnet-4-5'
    ]
  });

  const testModels = [
    'gemini-3-pro',
    'gemini-2.5-flash',
    'claude-sonnet-4-5',
  ];

  for (const model of testModels) {
    console.log(`\nChecking quota for model: ${model}`);
    console.log('─'.repeat(50));
    
    try {
      const result = await detector.checkHardLimit(model);
      
      console.log(`Status: ${result.isExhausted ? '❌ EXHAUSTED' : '✓ Available'}`);
      console.log(`Should Rotate: ${result.shouldRotate ? 'YES' : 'NO'}`);
      
      if (result.nextModel) {
        console.log(`Next Model: ${result.nextModel}`);
      }
      
      if (result.message) {
        console.log(`Message: ${result.message}`);
      }
    } catch (error) {
      console.error(`Error checking ${model}:`, error);
    }
  }

  console.log('\n\n=== Quota States ===\n');
  const tracker = detector.getQuotaTracker();
  const states = tracker.getAllQuotaStates();
  
  if (states.length === 0) {
    console.log('No quota data available');
  } else {
    for (const state of states) {
      const percentage = (state.quotaFraction * 100).toFixed(1);
      console.log(`${state.model}: ${percentage}%`);
    }
  }
}

testHardLimitDetection().catch(console.error);
