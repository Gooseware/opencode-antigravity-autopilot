import { QuotaManager } from '../manager';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface QuotaCache {
  percentage: number;
  model: string;
  timestamp: number;
}

function getQuotaCachePath(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return path.join(xdgConfigHome, 'opencode', 'quota-cache.json');
  }
  const homeDir = os.homedir();
  return path.join(homeDir, '.config', 'opencode', 'quota-cache.json');
}

export class QuotaCacheUpdater {
  private manager: QuotaManager;
  private intervalId: NodeJS.Timeout | null = null;
  private updateIntervalMs: number;

  constructor(manager: QuotaManager, updateIntervalMs: number = 60000) {
    this.manager = manager;
    this.updateIntervalMs = updateIntervalMs;
  }

  async updateCache(): Promise<void> {
    try {
      const quota = await this.manager.getQuotaViaApi();
      
      if (!quota) {
        return;
      }

      const cache: QuotaCache = {
        percentage: Math.round(quota.remainingFraction * 100),
        model: quota.model || 'unknown',
        timestamp: Date.now(),
      };

      const cachePath = getQuotaCachePath();
      const cacheDir = path.dirname(cachePath);

      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to update quota cache:', error);
    }
  }

  start(): void {
    this.updateCache();
    
    this.intervalId = setInterval(() => {
      this.updateCache();
    }, this.updateIntervalMs);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export async function startQuotaCacheService(updateIntervalMs: number = 60000): Promise<QuotaCacheUpdater> {
  const manager = new QuotaManager();
  await manager.initialize();

  const updater = new QuotaCacheUpdater(manager, updateIntervalMs);
  updater.start();

  return updater;
}
