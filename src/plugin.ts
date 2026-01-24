import { QuotaManager } from './manager';
import { QuotaCacheUpdater } from './quota/QuotaCacheUpdater';
import { HardLimitDetector } from './rotation/HardLimitDetector';
import type { PluginConfig } from './types';
import { translateModelName, formatModelQuotaForToast } from './utils/model-name-translator';
import fs from 'fs';

const LOG_FILE = '/tmp/autopilot.log';
function logToFile(message: string): void {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] [Plugin] ${message}\n`);
}

// Configuration
const QUOTA_WARNING_THRESHOLD = 0.15; // 15% - show warning
const QUOTA_CRITICAL_THRESHOLD = 0.10; // 10% - show critical/switch warning
const IDLE_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Minimal type definitions to avoid importing from @opencode-ai/plugin
interface PluginInput {
  client: any;
  project: any;
  directory: string;
  worktree: string;
  serverUrl: URL;
  $: any;
}

interface ToolDefinition {
  description: string;
  args: Record<string, any>;
  execute: (args: any, ctx: any) => Promise<string>;
}

interface Event {
  type: string;
  properties?: Record<string, any>;
}

interface Hooks {
  event?: (input: { event: Event }) => Promise<void>;
  tool?: Record<string, ToolDefinition>;
  "chat.message"?: (input: any, output: any) => Promise<void>;
}

type Plugin = (input: PluginInput) => Promise<Hooks>;

// Helper to create tool definitions
function tool(def: ToolDefinition): ToolDefinition {
  return def;
}

import os from 'os';
import path from 'path';

// Load config from ~/.config/opencode/quota.json
function loadQuotaConfig(): Partial<PluginConfig> {
  try {
    const configPath = path.join(os.homedir(), '.config', 'opencode', 'quota.json');
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      logToFile(`Loaded quota config: ${JSON.stringify(config)}`);
      return config;
    }
  } catch (error) {
    logToFile(`Failed to load quota config: ${error}`);
  }
  return {};
}

export const plugin: Plugin = async (ctx) => {
  const userConfig = loadQuotaConfig();
  const manager = new QuotaManager(userConfig);
  const detector = new HardLimitDetector(userConfig);
  await manager.initialize();

  const cacheUpdater = new QuotaCacheUpdater(manager, IDLE_POLL_INTERVAL_MS);
  cacheUpdater.start();

  logToFile('Autopilot plugin initialized with config');

  return {
    "chat.message": async (_, output) => {
      const currentModelID = output.message.model.modelID;
      
      const modelName = currentModelID.split('/').pop() || currentModelID;
      
      logToFile(`Checking model switch for ${modelName}`);
      
      try {
        const result = await detector.checkHardLimit(modelName);
        
        if (result.shouldRotate && result.nextModel && result.nextModel !== modelName) {
          logToFile(`Switching model: ${modelName} -> ${result.nextModel} (Reason: ${result.message})`);
          
          output.message.model.modelID = result.nextModel;
          
          if (result.nextModel.includes('claude')) {
            output.message.model.providerID = 'anthropic';
          } else if (result.nextModel.includes('gemini')) {
            output.message.model.providerID = 'google';
          }
          
          await ctx.client.tui.showToast({
            body: {
              title: 'Automatic Model Switch',
              message: result.message || `Switched to ${result.nextModel} due to quota.`,
              variant: 'warning'
            }
          });
        }
      } catch (err) {
        logToFile(`Error in chat.message hook: ${err}`);
      }
    },

    // Event hook - listen for session.idle to trigger quota refresh
    event: async ({ event }) => {
      if (event.type === 'session.idle') {
        logToFile('Session idle detected - refreshing quota');
        await cacheUpdater.onQueryCompleted();

        // Show notification with quota stats
        try {
          const quota = await manager.getQuotaViaApi();
          if (quota) {
            const percentage = Math.round(quota.remainingFraction * 100);
            const threshold = (userConfig.quotaThreshold || 0.02) * 100;
            const modelDisplayName = translateModelName(quota.model || 'Unknown');
            const quotaDisplay = formatModelQuotaForToast(quota.model || 'Unknown', percentage);

            let message = `${quotaDisplay} (Cutoff: ${threshold}%)`;

            if (quota.resetTime) {
              const resetDate = new Date(quota.resetTime);
              const now = new Date();
              const diffMs = resetDate.getTime() - now.getTime();
              if (diffMs > 0) {
                const minutesLeft = Math.ceil(diffMs / 60000);
                const hours = Math.floor(minutesLeft / 60);
                const mins = minutesLeft % 60;
                message += ` | Reset in: ${hours}h ${mins}m`;
              }
            }

            await ctx.client.tui.showToast({
              body: {
                title: modelDisplayName,
                message,
                variant: percentage <= threshold ? 'critical' : percentage <= threshold * 2 ? 'warning' : 'info'
              }
            });
          }
        } catch (err) {
          logToFile(`Failed to show quota toast: ${err}`);
        }
      }
    },

    tool: {
      autopilot_quota_status: tool({
        description: 'Get current quota status for all models',
        args: {},
        async execute(args, toolCtx) {
          try {
            const allQuotas = await manager.getAllQuotasViaApi();
            if (allQuotas.size === 0) {
              return '❌ No quota information available. Check authentication.';
            }

            const lines: string[] = ['# 📊 Quota Status\n'];

            const seen = new Set<string>();
            for (const [model, quota] of allQuotas) {
              if (seen.has(quota.model || model)) continue;
              seen.add(quota.model || model);

              const percentage = Math.round(quota.remainingFraction * 100);
              const bar = '█'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));
              const status = percentage <= 10 ? '🔴' : percentage <= 25 ? '🟡' : '🟢';

              lines.push(`${status} **${quota.model || model}**: ${bar} ${percentage}%`);
              if (quota.resetTime) {
                lines.push(`   Reset: ${quota.resetTime}`);
              }
            }

            return lines.join('\n');
          } catch (err) {
            logToFile(`Error in quota_status tool: ${err}`);
            return `❌ Error: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),

      autopilot_check_quota: tool({
        description: 'Check quota and refresh cache',
        args: {},
        async execute(args, toolCtx) {
          try {
            await cacheUpdater.onQueryCompleted();

            const allQuotas = await manager.getAllQuotasViaApi();
            if (allQuotas.size === 0) {
              return 'No quota data available';
            }

            let lowestQuota = 1.0;
            let lowestModel = '';
            for (const [model, quota] of allQuotas) {
              if (quota.remainingFraction < lowestQuota) {
                lowestQuota = quota.remainingFraction;
                lowestModel = model;
              }
            }

            const percentage = Math.round(lowestQuota * 100);

            if (lowestQuota <= QUOTA_CRITICAL_THRESHOLD) {
              return `⚠️ CRITICAL: ${lowestModel} at ${percentage}%. Switch imminent.`;
            } else if (lowestQuota <= QUOTA_WARNING_THRESHOLD) {
              return `⚠️ WARNING: ${lowestModel} at ${percentage}%.`;
            } else {
              return `✅ Quota OK: ${lowestModel} at ${percentage}%.`;
            }
          } catch (err) {
            return `Error: ${err instanceof Error ? err.message : String(err)}`;
          }
        },
      }),
    },
  };
};

export default plugin;

// Backward compatibility export
export const AntigravityQuotaPlugin = plugin;

// Re-export for programmatic use
export { QuotaManager } from './manager';
export { QuotaCacheUpdater } from './quota/QuotaCacheUpdater';
export { ApiQuotaPoller } from './quota/ApiQuotaPoller';
export type { PluginConfig, ModelRotationStrategy, QuotaInfo, ModelQuotaState } from './types';
