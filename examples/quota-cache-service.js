# Example: Quota Cache Service

import { startQuotaCacheService } from 'opencode-antigravity-autopilot';
import fs from 'fs';
import path from 'path';
import os from 'os';

async function runCacheService() {
  console.log('Starting quota cache service...\n');

  // Start service with 30-second update interval
  const updater = await startQuotaCacheService(30000);

  console.log('✓ Service started');
  console.log('  Updates every 30 seconds');
  console.log('  Press Ctrl+C to stop\n');

  // Monitor the cache file
  const cachePath = path.join(
    os.homedir(),
    '.config',
    'opencode',
    'quota-cache.json'
  );

  setInterval(() => {
    if (fs.existsSync(cachePath)) {
      const content = fs.readFileSync(cachePath, 'utf-8');
      const cache = JSON.parse(content);
      
      console.log(`[${new Date().toLocaleTimeString()}] Quota: ${cache.percentage}% for ${cache.model}`);
    }
  }, 5000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\nStopping service...');
    updater.stop();
    console.log('✓ Service stopped');
    process.exit(0);
  });
}

runCacheService().catch(console.error);
