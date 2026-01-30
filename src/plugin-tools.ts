import { QuotaManager } from './manager';
import { HardLimitDetector } from './rotation/HardLimitDetector';
import type { PluginConfig } from './types';
import { getLogger } from './utils/logger';

export function createQuotaTools(config?: PluginConfig) {
  const manager = new QuotaManager(config);
  const detector = new HardLimitDetector(config);
  const logger = getLogger();

  return {
    quota_status: {
      description: 'Check current quota status for Antigravity models. Use detailed=true for all models.',
      args: {},
      async execute(args: { detailed?: boolean } = {}, ctx?: any) {
        logger.info('PluginTools', 'quota_status invoked', { detailed: args.detailed });

        await manager.initialize();

        const currentQuota = await manager.getQuotaViaApi();
        const accounts = manager['tokenReader'].getAccounts();
        const activeIndex = manager['tokenReader'].getActiveIndex();

        if (!currentQuota) {
          logger.error('PluginTools', 'quota_status: could not fetch quota');
          return 'Could not fetch quota information. Ensure opencode-antigravity-auth is configured.';
        }

        const percentage = Math.round(currentQuota.remainingFraction * 100);
        let statusIcon = '';
        let statusText = '';

        // Standardized thresholds: < 20% Critical, < 50% Warning, >= 50% Healthy
        if (percentage <= 0) {
          statusIcon = '❌';
          statusText = 'exhausted';
        } else if (percentage < 20) {
          statusIcon = '❌';
          statusText = 'critical';
        } else if (percentage < 50) {
          statusIcon = '⚠';
          statusText = 'running low';
        } else {
          statusIcon = '✓';
          statusText = 'healthy';
        }

        let output = `# Quota Status\n\n`;
        output += `${statusIcon} **Current Model:** ${currentQuota.model || 'Unknown'}\n`;
        output += `**Status:** ${statusText.toUpperCase()} (${percentage}% remaining)\n`;
        output += `**Account:** ${activeIndex + 1} of ${accounts.length} active\n`;

        if (args.detailed) {
          const allQuotas = await manager.getAllQuotasViaApi();

          if (allQuotas.size > 0) {
            output += `\n## Available Models\n\n`;

            // Filter and sort models similar to opencode-antigravity-quota
            const sortedModels = Array.from(allQuotas.entries())
              .filter(([name]) => {
                const lower = name.toLowerCase();
                return !lower.startsWith('chat_') &&
                  !lower.startsWith('rev19') &&
                  !lower.includes('gemini 2.5') &&
                  !lower.includes('gemini 3 pro image');
              })
              .sort((a, b) => a[0].localeCompare(b[0]));

            for (const [modelName, quota] of sortedModels) {
              const pct = Math.round(quota.remainingFraction * 100);
              let icon = '✓';
              if (pct <= 0) icon = '❌';
              else if (pct < 20) icon = '❌';
              else if (pct < 50) icon = '⚠';

              output += `- ${icon} **${modelName}**: ${pct}%\n`;
            }
          }
        } else {
          output += `\n*Tip: Run with { detailed: true } to see all models*\n`;
        }

        return output;
      },
    },

    quota_check_model: {
      description: 'Check if a specific model has enough quota. Provide model name as argument.',
      args: {},
      async execute(args: { model: string }, ctx?: any) {
        logger.info('PluginTools', 'quota_check_model invoked', { model: args.model });

        if (!args.model) {
          logger.error('PluginTools', 'quota_check_model: missing model argument');
          return 'Error: model argument is required. Example: quota_check_model({model: "gemini-3-pro"})';
        }

        const result = await detector.checkHardLimit(args.model);

        let icon = '';
        if (result.isExhausted) {
          icon = '❌';
        } else if (result.shouldRotate) {
          icon = '⚠';
        } else {
          icon = '✓';
        }

        let output = `# Model Quota Check: ${args.model}\n\n`;
        output += `${icon} **${result.message}**\n\n`;

        if (result.shouldRotate) {
          output += `**Recommendation:** ${result.nextModel ? `Switch to ${result.nextModel}` : 'Rotate to next account'}\n\n`;
        } else {
          output += `**Status:** OK to proceed\n\n`;
        }

        if (result.isExhausted) {
          output += `⚠ This model is currently exhausted. Using it will fail.\n`;
        }

        return output;
      },
    },

    quota_use_model: {
      description: 'Manually select a model to use. This disables automatic switching until quota_auto_mode is called.',
      args: {
        model: { type: 'string', description: 'The model name to use (e.g. gemini-3-pro)' }
      },
      async execute(args: { model: string }, ctx?: any) {
        logger.info('PluginTools', 'quota_use_model invoked', { model: args.model });
        if (!args.model) return 'Error: model name is required.';
        manager.setManualSelection(true);
        // We don't actually "set" it in OpenCode here, but we mark it as manual for the plugin's logic
        return `✓ Manual selection mode enabled for **${args.model}**. Automatic switching is now disabled for this session. Use \`quota_auto_mode()\` to re-enable it.`;
      },
    },

    quota_rotate_account: {
      description: 'Manually rotate to the next available account when current is exhausted. Optionally provide resetTimeISO for accurate cooldown.',
      args: {},
      async execute(args?: { resetTimeISO?: string }, ctx?: any) {
        logger.info('PluginTools', 'quota_rotate_account invoked', { resetTimeISO: args?.resetTimeISO });

        await manager.rotateAccount(args?.resetTimeISO);

        if (args?.resetTimeISO) {
          const resetDate = new Date(args.resetTimeISO);
          const now = new Date();
          const minutesUntilReset = Math.round((resetDate.getTime() - now.getTime()) / (60 * 1000));
          return `✓ Rotated to next account. Previous account will be available again at ${resetDate.toISOString()} (~${minutesUntilReset} minutes).`;
        }

        return `✓ Rotated to next account. Previous account marked as exhausted for 30 minutes.`;
      },
    },
    quota_auto_mode: {
      description: 'Re-enable automatic model switching and rotation. Use this after a manual model selection to return to optimal model selection.',
      args: {},
      async execute(args: {} = {}, ctx?: any) {
        logger.info('PluginTools', 'quota_auto_mode invoked');
        manager.setManualSelection(false);
        return '✓ Automatic model selection re-enabled. System will now proactively switch to the best available preferred model.';
      },
    },
  };
}
