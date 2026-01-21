# Example: oh-my-opencode Integration

import { 
  createOhMyOpenCodeIntegration,
  QuotaManager 
} from 'opencode-antigravity-autopilot';

async function ohMyOpenCodeDemo() {
  // Initialize quota manager
  const manager = new QuotaManager({
    quotaThreshold: 0.15,
    preferredModels: [
      'google/antigravity-gemini-3-pro',
      'google/antigravity-claude-sonnet-4-5'
    ]
  });
  
  await manager.initialize();

  // Create oh-my-opencode integration
  const integration = createOhMyOpenCodeIntegration(manager, {
    defaultModel: 'google/antigravity-gemini-3-flash'
  });

  // Get recommended model for different agents
  const agents = ['Sisyphus', 'oracle', 'librarian', 'explore'];

  console.log('Recommended models for agents:\n');

  for (const agent of agents) {
    const model = await integration.getModelForAgent(agent);
    console.log(`${agent}: ${model}`);
  }

  // Update agent configuration based on quota
  console.log('\n\nPolling quota and updating config...');
  
  await integration.pollQuotaAndRotate([
    'google/antigravity-gemini-3-pro',
    'google/antigravity-claude-sonnet-4-5',
    'google/antigravity-gemini-3-flash'
  ]);

  console.log('✓ Quota updated');
}

ohMyOpenCodeDemo().catch(console.error);
