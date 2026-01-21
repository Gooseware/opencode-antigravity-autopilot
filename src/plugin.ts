import { QuotaManager } from './manager';
import { createQuotaTools } from './plugin-tools';
import type { PluginConfig } from './types';

interface PluginContext {
  client: any;
  directory: string;
}

interface PluginResult {
  tool?: Record<string, any>;
  loader?: () => Promise<any>;
}

export const AntigravityQuotaPlugin = async (
  { client, directory }: PluginContext,
  config?: PluginConfig
): Promise<PluginResult> => {
  const manager = new QuotaManager(config);
  await manager.initialize();

  const quotaTools = createQuotaTools(config);

  return {
    tool: quotaTools,
    loader: async () => {
      return {
        getQuota: async () => manager.getQuota(),
        rotateAccount: async () => manager.rotateAccount(),
        selectBestModel: () => manager.selectBestModel(),
        updateQuotaForModel: (model: string, quota: any) =>
          manager.updateQuotaForModel(model, quota),
        getQuotaTracker: () => manager.getQuotaTracker(),
        setModelRotationStrategy: (strategy: any) =>
          manager.setModelRotationStrategy(strategy),
      };
    },
  };
};

export { QuotaManager } from './manager';
export { createOhMyOpenCodeIntegration, generateOhMyOpenCodeConfig } from './oh-my-opencode';
export type { PluginConfig, ModelRotationStrategy, QuotaInfo, ModelQuotaState } from './types';
export { TokenStorageReader } from './auth/TokenStorageReader';
export { AccountRotator } from './auth/AccountRotator';
export { LSPFinder } from './quota/LSPFinder';
export { QuotaPoller } from './quota/QuotaPoller';
export { ApiQuotaPoller } from './quota/ApiQuotaPoller';
export { QuotaTracker } from './rotation/QuotaTracker';
export { ModelSelector } from './rotation/ModelSelector';
