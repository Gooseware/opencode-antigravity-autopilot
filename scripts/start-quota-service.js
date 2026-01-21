#!/usr/bin/env node

import { startQuotaCacheService } from '../dist/quota/QuotaCacheUpdater.js';

const UPDATE_INTERVAL_MS = parseInt(process.env.QUOTA_UPDATE_INTERVAL) || 60000;

console.log('Starting quota cache updater service...');
console.log(`Update interval: ${UPDATE_INTERVAL_MS}ms (${UPDATE_INTERVAL_MS / 1000}s)\n`);

startQuotaCacheService(UPDATE_INTERVAL_MS)
  .then((updater) => {
    console.log('✓ Quota cache updater service started successfully');
    console.log('  The service will update quota cache every', UPDATE_INTERVAL_MS / 1000, 'seconds');
    console.log('  Press Ctrl+C to stop\n');

    process.on('SIGINT', () => {
      console.log('\n\nStopping quota cache updater service...');
      updater.stop();
      console.log('✓ Service stopped');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      console.log('\n\nStopping quota cache updater service...');
      updater.stop();
      console.log('✓ Service stopped');
      process.exit(0);
    });
  })
  .catch((error) => {
    console.error('Failed to start quota cache updater:', error);
    process.exit(1);
  });
