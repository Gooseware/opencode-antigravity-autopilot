import { QuotaManager } from './manager';
import { QuotaCacheUpdater } from './quota/QuotaCacheUpdater';
import type { PluginConfig } from './types';
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
}

type Plugin = (input: PluginInput) => Promise<Hooks>;

// Helper to create tool definitions
function tool(def: ToolDefinition): ToolDefinition {
  return def;
}

export const plugin: Plugin = async (ctx) => {
  const manager = new QuotaManager();
  await manager.initialize();

  const cacheUpdater = new QuotaCacheUpdater(manager, IDLE_POLL_INTERVAL_MS);
  cacheUpdater.start();

  logToFile('Autopilot plugin initialized');

  return {
    // Event hook - listen for session.idle to trigger quota refresh
    event: async ({ event }) => {
      if (event.type === 'session.idle') {
        logToFile('Session idle detected - refreshing quota');
        await cacheUpdater.onQueryCompleted();
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
