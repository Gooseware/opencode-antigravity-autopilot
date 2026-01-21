import { TokenStorageReader } from './auth/TokenStorageReader';
import { AccountRotator } from './auth/AccountRotator';
import { LSPFinder } from './quota/LSPFinder';
import { QuotaPoller, QuotaInfo } from './quota/QuotaPoller';
import { QuotaTracker } from './rotation/QuotaTracker';
import { ModelSelector } from './rotation/ModelSelector';
import { PluginConfig, ModelRotationStrategy } from './types';

export class QuotaManager {
  private tokenReader: TokenStorageReader;
  private rotator: AccountRotator;
  private lspFinder: LSPFinder;
  private poller: QuotaPoller;
  private quotaTracker: QuotaTracker;
  private modelSelector: ModelSelector | null = null;
  private lspProcess: { pid: number; csrfToken: string; port: number } | null = null;

  constructor(config?: PluginConfig) {
    this.tokenReader = new TokenStorageReader();
    const accounts = this.tokenReader.getAccounts();
    const activeIndex = this.tokenReader.getActiveIndex();

    this.rotator = new AccountRotator(accounts, activeIndex);
    this.lspFinder = new LSPFinder();
    this.poller = new QuotaPoller();
    this.quotaTracker = new QuotaTracker(config?.quotaThreshold || 0.2);

    if (config?.preferredModels) {
      const strategy: ModelRotationStrategy = {
        preferredModels: config.preferredModels,
        fallbackModels: [],
        quotaThreshold: config.quotaThreshold || 0.2,
      };
      this.modelSelector = new ModelSelector(this.quotaTracker, strategy);
    }
  }

  async initialize(): Promise<void> {
    this.lspProcess = await this.lspFinder.findProcess();
  }

  async getToken(): Promise<string | null> {
    const account = this.rotator.getCurrentAccount();
    return account ? account.refreshToken : null;
  }

  async getQuota(): Promise<QuotaInfo | null> {
    if (!this.lspProcess) {
      this.lspProcess = await this.lspFinder.findProcess();
    }

    if (!this.lspProcess) {
      return null;
    }

    const quota = await this.poller.checkQuota(
      this.lspProcess.port,
      this.lspProcess.csrfToken
    );

    if (!quota) {
      this.lspProcess = null;
    }

    return quota;
  }

  async rotateAccount(): Promise<void> {
    this.rotator.markCurrentExhausted();
    this.quotaTracker.clearAll();
  }

  selectBestModel(): string | null {
    return this.modelSelector?.selectModel() || null;
  }

  updateQuotaForModel(model: string, quota: QuotaInfo): void {
    this.quotaTracker.updateQuota(model, quota);
  }

  getQuotaTracker(): QuotaTracker {
    return this.quotaTracker;
  }

  setModelRotationStrategy(strategy: ModelRotationStrategy): void {
    this.modelSelector = new ModelSelector(this.quotaTracker, strategy);
  }
}

export async function activate(config?: PluginConfig) {
  const manager = new QuotaManager(config);
  await manager.initialize();

  return {
    async getToken(): Promise<string | null> {
      return manager.getToken();
    },

    async getQuota(): Promise<QuotaInfo | null> {
      return manager.getQuota();
    },

    async rotateAccount(): Promise<void> {
      return manager.rotateAccount();
    },

    selectBestModel(): string | null {
      return manager.selectBestModel();
    },

    updateQuotaForModel(model: string, quota: QuotaInfo): void {
      manager.updateQuotaForModel(model, quota);
    },

    getQuotaTracker(): QuotaTracker {
      return manager.getQuotaTracker();
    },

    setModelRotationStrategy(strategy: ModelRotationStrategy): void {
      manager.setModelRotationStrategy(strategy);
    },
  };
}
