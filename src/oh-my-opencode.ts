import { QuotaManager } from './manager';
import { PluginConfig, ModelRotationStrategy } from './types';
import { getLogger } from './utils/logger';

interface OhMyOpenCodeConfig {
  agents: Record<string, { model: string }>;
}

export function createOhMyOpenCodeIntegration(
  quotaManager: QuotaManager,
  config?: { defaultModel?: string }
) {
  const logger = getLogger();
  return {
    async getModelForAgent(agentName: string, preferredModel?: string): Promise<string> {
      const targetModel = preferredModel || config?.defaultModel;
      const quotaThreshold = quotaManager.getQuotaTracker().getThreshold();
      const isManual = quotaManager.getIsManualSelection();

      logger.debug('Integration', 'getModelForAgent called', {
        agentName,
        preferredModel,
        targetModel,
        quotaThreshold,
        isManual
      });

      // If we have a target model and we are NOT in manual mode, 
      // check if it's available. If it is, use it even if we were using a fallback.
      if (targetModel && !isManual) {
        if (quotaManager.getQuotaTracker().isModelAvailable(targetModel)) {
          logger.info('Integration', 'Target model is available, using it', { targetModel });
          return targetModel;
        }
      }

      if (!targetModel) {
        logger.info('Integration', 'No target model, selecting best available');
        let selected = quotaManager.selectBestModel();
        if (!selected) {
          logger.warn('Integration', 'No model selected, rotating account');
          await quotaManager.rotateAccount();
          selected = quotaManager.selectBestModel();
        }
        const finalModel = selected || 'google/antigravity-gemini-3-flash';
        logger.info('Integration', 'Final model selected', { finalModel });
        return finalModel;
      }

      const quotaState = quotaManager.getQuotaTracker().getQuotaForModel(targetModel);

      if (quotaState && quotaState.quotaFraction < quotaThreshold) {
        logger.warn('Integration', 'Target model below threshold, finding fallback', {
          targetModel,
          quotaFraction: quotaState.quotaFraction,
          threshold: quotaThreshold
        });
        const fallback = quotaManager.selectBestModel();
        if (!fallback) {
          logger.warn('Integration', 'No fallback found, rotating account but sticking to target as last resort');
          await quotaManager.rotateAccount();
          return targetModel;
        }
        logger.info('Integration', 'Fallback model selected', { fallback });
        return fallback;
      }

      logger.debug('Integration', 'Using target model', { targetModel });
      return targetModel;
    },

    updateAgentConfig(
      existingConfig: OhMyOpenCodeConfig,
      modelRotationStrategy: ModelRotationStrategy
    ): OhMyOpenCodeConfig {
      quotaManager.setModelRotationStrategy(modelRotationStrategy);

      const updatedAgents: Record<string, { model: string }> = {};

      for (const [agentName, agentConfig] of Object.entries(existingConfig.agents)) {
        const bestModel = quotaManager.selectBestModel();
        updatedAgents[agentName] = {
          model: bestModel || agentConfig.model,
        };
      }

      return {
        ...existingConfig,
        agents: updatedAgents,
      };
    },

    async pollQuotaAndRotate(models: string[]): Promise<void> {
      for (const model of models) {
        const quota = await quotaManager.getQuota();
        if (quota) {
          quotaManager.updateQuotaForModel(model, quota);
        }
      }
    },
  };
}

export function generateOhMyOpenCodeConfig(
  preferredModels: string[]
): OhMyOpenCodeConfig {
  const defaultAgents = [
    'Sisyphus',
    'librarian',
    'explore',
    'oracle',
    'frontend-ui-ux-engineer',
    'document-writer',
    'multimodal-looker',
  ];

  const agents: Record<string, { model: string }> = {};

  defaultAgents.forEach((agent, index) => {
    const modelIndex = index % preferredModels.length;
    agents[agent] = {
      model: preferredModels[modelIndex] || 'google/antigravity-gemini-3-flash',
    };
  });

  return { agents };
}
