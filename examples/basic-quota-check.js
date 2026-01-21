# Example: Basic Quota Checking

import { QuotaManager } from 'opencode-antigravity-autopilot';

async function checkQuota() {
  const manager = new QuotaManager();
  await manager.initialize();

  // Check quota for current model
  const quota = await manager.getQuotaViaApi();
  
  if (quota) {
    const percentage = (quota.remainingFraction * 100).toFixed(1);
    console.log(`Current quota: ${percentage}% for model ${quota.model}`);
    
    if (quota.remainingFraction < 0.2) {
      console.log('Warning: Quota running low!');
    }
  } else {
    console.log('Could not fetch quota');
  }
}

checkQuota().catch(console.error);
