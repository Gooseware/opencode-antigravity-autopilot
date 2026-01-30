import fs from 'fs';
import path from 'path';
import os from 'os';
import { writeQuotaToCache } from '../../src/quota/QuotaCacheUpdater';

describe('QuotaCacheUpdater', () => {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  const homeDir = os.homedir();
  const cachePath = xdgConfigHome 
    ? path.join(xdgConfigHome, 'opencode', 'quota-cache.json')
    : path.join(homeDir, '.config', 'opencode', 'quota-cache.json');

  beforeEach(() => {
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
  });

  it('should write detailed quota info to cache', async () => {
    const quota = {
      remainingFraction: 0.75,
      model: 'gemini-3-pro',
      resetTime: '2026-01-31T00:00:00.000Z'
    };

    await writeQuotaToCache(quota);

    expect(fs.existsSync(cachePath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    
    expect(content.percentage).toBe(75);
    expect(content.quotaUsed).toBe(25);
    expect(content.model).toBe('gemini-3-pro');
    expect(content.refreshDate).toBe(quota.resetTime);
    expect(content.humanReadable).toContain('75% remaining');
    expect(content.humanReadable).toContain('gemini-3-pro');
  });
});
