# Example: Hard Limit Detection with Auto-Switch

import { HardLimitDetector } from 'opencode-antigravity-autopilot';

async function autoSwitchDemo() {
  const detector = new HardLimitDetector({
    quotaThreshold: 0.2,  // Switch when below 20%
    preferredModels: [
      'google/antigravity-gemini-3-pro',
      'google/antigravity-claude-sonnet-4-5',
      'google/antigravity-gemini-3-flash'
    ]
  });

  const modelsToTest = [
    'gemini-3-pro',
    'claude-sonnet-4-5',
    'gemini-3-flash'
  ];

  console.log('Testing hard limit detection...\n');

  for (const model of modelsToTest) {
    const result = await detector.checkHardLimit(model);
    
    console.log(`Model: ${model}`);
    console.log(`  Exhausted: ${result.isExhausted ? 'YES' : 'NO'}`);
    console.log(`  Should Rotate: ${result.shouldRotate ? 'YES' : 'NO'}`);
    
    if (result.nextModel) {
      console.log(`  Next Model: ${result.nextModel}`);
    }
    
    console.log(`  Message: ${result.message}`);
    console.log('');
  }
}

autoSwitchDemo().catch(console.error);
