import { QuotaManager } from './manager';
import { PluginConfig, ModelRotationStrategy } from './types';

interface OhMyOpenCodeConfig {
  agents: Record<string, { model: string }>;
}

export function createOhMyOpenCodeIntegration(
  quotaManager: QuotaManager,
  config?: { defaultModel?: string }
) {
  return {
    async getModelForAgent(agentName: string, preferredModel?: string): Promise<string> {
      const targetModel = preferredModel || config?.defaultModel;

      if (!targetModel) {
        let selected = quotaManager.selectBestModel();
        if (!selected) {
          await quotaManager.rotateAccount();
          selected = quotaManager.selectBestModel();
        }
        return selected || 'google/antigravity-gemini-3-flash';
      }

      const quotaState = quotaManager.getQuotaTracker().getQuotaForModel(targetModel);

      if (quotaState && quotaState.quotaFraction < 0.2) {
        const fallback = quotaManager.selectBestModel();
        if (!fallback) {
          await quotaManager.rotateAccount();
          return targetModel;
        }
        return fallback;
      }

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
