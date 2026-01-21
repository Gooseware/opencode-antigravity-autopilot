import { TokenStorageReader } from '../auth/TokenStorageReader';
import { AccountRotator } from '../auth/AccountRotator';
import { ApiQuotaPoller } from '../quota/ApiQuotaPoller';
import { QuotaTracker } from '../rotation/QuotaTracker';
import { ModelSelector } from '../rotation/ModelSelector';
import { PluginConfig, ModelRotationStrategy, QuotaInfo } from '../types';

export interface HardLimitCheckResult {
  isExhausted: boolean;
  shouldRotate: boolean;
  nextModel?: string;
  message?: string;
}

export class HardLimitDetector {
  private tokenReader!: TokenStorageReader;
  private rotator!: AccountRotator;
  private apiPoller!: ApiQuotaPoller;
  private quotaTracker!: QuotaTracker;
  private modelSelector!: ModelSelector | null;
  private quotaThreshold!: number;

  constructor(config?: PluginConfig) {
    if (!(this instanceof HardLimitDetector)) {
      // @ts-ignore
      return new HardLimitDetector(config);
    }

    this.tokenReader = new TokenStorageReader();
    const accounts = this.tokenReader.getAccounts();
    const activeIndex = this.tokenReader.getActiveIndex();

    this.rotator = new AccountRotator(accounts, activeIndex);
    this.apiPoller = new ApiQuotaPoller();
    this.quotaThreshold = config?.quotaThreshold || 0.2;
    this.quotaTracker = new QuotaTracker(this.quotaThreshold);
    this.modelSelector = null;

    if (config?.preferredModels) {
      const strategy: ModelRotationStrategy = {
        preferredModels: config.preferredModels,
        fallbackModels: [],
        quotaThreshold: this.quotaThreshold,
      };
      this.modelSelector = new ModelSelector(this.quotaTracker, strategy);
    }
  }

  async checkHardLimit(currentModel: string): Promise<HardLimitCheckResult> {
    const account = this.rotator.getCurrentAccount();
    if (!account) {
      return {
        isExhausted: false,
        shouldRotate: false,
        message: 'No active account found',
      };
    }

    const quota = await this.apiPoller.checkQuotaForModel(account, currentModel);
    
    if (!quota) {
      return {
        isExhausted: false,
        shouldRotate: false,
        message: 'Could not fetch quota information',
      };
    }

    this.quotaTracker.updateQuota(currentModel, quota);

    if (quota.remainingFraction <= 0) {
      const nextModel = this.modelSelector?.selectModel();
      
      if (!nextModel) {
        this.rotator.markCurrentExhausted();
        
        return {
          isExhausted: true,
          shouldRotate: true,
          message: `Model ${currentModel} exhausted (0% quota). Rotated to next account.`,
        };
      }

      return {
        isExhausted: true,
        shouldRotate: true,
        nextModel,
        message: `Model ${currentModel} exhausted (0% quota). Switching to ${nextModel}.`,
      };
    }

    if (quota.remainingFraction < this.quotaThreshold) {
      const nextModel = this.modelSelector?.selectModel();
      
      if (nextModel && nextModel !== currentModel) {
        return {
          isExhausted: false,
          shouldRotate: true,
          nextModel,
          message: `Model ${currentModel} below threshold (${(quota.remainingFraction * 100).toFixed(1)}%). Switching to ${nextModel}.`,
        };
      }
    }

    return {
      isExhausted: false,
      shouldRotate: false,
      message: `Model ${currentModel} has ${(quota.remainingFraction * 100).toFixed(1)}% quota remaining.`,
    };
  }

  async updateAllQuotas(): Promise<void> {
    const account = this.rotator.getCurrentAccount();
    if (!account) return;

    const quotas = await this.apiPoller.getAllQuotas(account);
    
    for (const [model, quota] of quotas.entries()) {
      this.quotaTracker.updateQuota(model, quota);
    }
  }

  setModelRotationStrategy(strategy: ModelRotationStrategy): void {
    this.modelSelector = new ModelSelector(this.quotaTracker, strategy);
  }

  getQuotaTracker(): QuotaTracker {
    return this.quotaTracker;
  }

  async rotateAccount(): Promise<void> {
    this.rotator.markCurrentExhausted();
    this.quotaTracker.clearAll();
  }
}
