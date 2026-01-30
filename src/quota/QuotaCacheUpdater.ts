import { QuotaManager } from '../manager';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { QuotaCache } from '../types';

const LOG_FILE = '/tmp/autopilot.log';
function logToFile(message: string): void {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] [QuotaCacheUpdater] ${message}\n`);
}

function getQuotaCachePath(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome) {
    return path.join(xdgConfigHome, 'opencode', 'quota-cache.json');
  }
  const homeDir = os.homedir();
  return path.join(homeDir, '.config', 'opencode', 'quota-cache.json');
}

export async function writeQuotaToCache(quota: { remainingFraction: number; model?: string; resetTime?: string }): Promise<void> {
  try {
    const percentage = Math.round(quota.remainingFraction * 100);
    const model = quota.model || 'unknown';
    const refreshDate = quota.resetTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const cache: QuotaCache = {
      percentage,
      quotaUsed: 100 - percentage,
      model,
      timestamp: Date.now(),
      refreshDate,
      humanReadable: `${percentage}% remaining for ${model}. Quota resets at ${new Date(refreshDate).toLocaleString()}.`,
    };

    const cachePath = getQuotaCachePath();
    const cacheDir = path.dirname(cachePath);

    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    logToFile(`Failed to write quota cache: ${error}`);
  }
}

const DEFAULT_IDLE_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class QuotaCacheUpdater {
  private manager!: QuotaManager;
  private idleTimeoutId!: NodeJS.Timeout | null;
  private idlePollIntervalMs!: number;
  private lastQueryTime!: number;

  constructor(manager: QuotaManager, idlePollIntervalMs: number = DEFAULT_IDLE_POLL_INTERVAL_MS) {
    if (!(this instanceof QuotaCacheUpdater)) {
      // @ts-ignore
      return new QuotaCacheUpdater(manager, idlePollIntervalMs);
    }
    this.idleTimeoutId = null;
    this.manager = manager;
    this.idlePollIntervalMs = idlePollIntervalMs;
    this.lastQueryTime = 0;
  }

  async updateCache(): Promise<void> {
    try {
      const quota = await this.manager.getQuotaViaApi();

      if (!quota) {
        return;
      }

      await writeQuotaToCache(quota);
      logToFile(`Cache updated successfully for ${quota.model}`);
    } catch (error) {
      logToFile(`Failed to update quota cache: ${error}`);
    }
  }

  /**
   * Called after a query is made to refresh quota and reset idle timer.
   */
  async onQueryCompleted(): Promise<void> {
    this.lastQueryTime = Date.now();
    await this.updateCache();
    this.resetIdleTimer();
  }

  /**
   * Start the updater - polls immediately and sets up idle polling.
   */
  start(): void {
    logToFile('Starting QuotaCacheUpdater');
    this.lastQueryTime = Date.now();
    this.updateCache();
    this.resetIdleTimer();
  }

  /**
   * Reset the idle timer. Called after each query.
   */
  private resetIdleTimer(): void {
    if (this.idleTimeoutId) {
      clearTimeout(this.idleTimeoutId);
    }

    this.idleTimeoutId = setTimeout(async () => {
      const timeSinceLastQuery = Date.now() - this.lastQueryTime;
      logToFile(`Idle poll triggered. Time since last query: ${Math.round(timeSinceLastQuery / 1000)}s`);
      await this.updateCache();
      this.resetIdleTimer(); // Schedule next idle poll
    }, this.idlePollIntervalMs);
  }

  stop(): void {
    if (this.idleTimeoutId) {
      clearTimeout(this.idleTimeoutId);
      this.idleTimeoutId = null;
    }
    logToFile('QuotaCacheUpdater stopped');
  }
}

export async function startQuotaCacheService(idlePollIntervalMs: number = DEFAULT_IDLE_POLL_INTERVAL_MS): Promise<QuotaCacheUpdater> {
  const manager = new QuotaManager();
  await manager.initialize();

  const updater = new QuotaCacheUpdater(manager, idlePollIntervalMs);
  updater.start();

  return updater;
}
