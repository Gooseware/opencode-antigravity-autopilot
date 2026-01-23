import { TokenStorageReader } from '../auth/TokenStorageReader';
import { AccountRotator } from '../auth/AccountRotator';
import { ApiQuotaPoller } from '../quota/ApiQuotaPoller';
import { QuotaTracker } from '../rotation/QuotaTracker';
import { ModelSelector } from '../rotation/ModelSelector';
import { PluginConfig, ModelRotationStrategy, QuotaInfo } from '../types';
import { getLogger } from '../utils/logger';

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
  private logger!: ReturnType<typeof getLogger>;

  constructor(config?: PluginConfig) {
    if (!(this instanceof HardLimitDetector)) {
      // @ts-ignore
      return new HardLimitDetector(config);
    }

    this.logger = getLogger();
    this.tokenReader = new TokenStorageReader();
    const accounts = this.tokenReader.getAccounts();
    const activeIndex = this.tokenReader.getActiveIndex();

    this.rotator = new AccountRotator(accounts, activeIndex);
    this.apiPoller = new ApiQuotaPoller();
    this.quotaThreshold = config?.quotaThreshold || 0.02;
    this.quotaTracker = new QuotaTracker(this.quotaThreshold);
    this.modelSelector = null;

    this.logger.info('HardLimitDetector', 'Initialized', {
      quotaThreshold: this.quotaThreshold,
      thresholdPercentage: `${(this.quotaThreshold * 100).toFixed(1)}%`,
      accountsCount: accounts.length,
      activeIndex,
    });

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
    this.logger.debug('HardLimitDetector', 'Starting hard limit check', { currentModel });

    const account = this.rotator.getCurrentAccount();
    if (!account) {
      this.logger.warn('HardLimitDetector', 'No active account found');
      return {
        isExhausted: false,
        shouldRotate: false,
        message: 'No active account found',
      };
    }

    this.logger.debug('HardLimitDetector', 'Fetching quota from API', {
      model: currentModel,
      accountEmail: account.email,
    });

    const quota = await this.apiPoller.checkQuotaForModel(account, currentModel);

    if (!quota) {
      this.logger.error('HardLimitDetector', 'Failed to fetch quota information', { currentModel });
      return {
        isExhausted: false,
        shouldRotate: false,
        message: 'Could not fetch quota information',
      };
    }

    const quotaPercentage = (quota.remainingFraction * 100).toFixed(1);
    this.logger.info('HardLimitDetector', 'Quota fetched successfully', {
      model: currentModel,
      remainingFraction: quota.remainingFraction,
      quotaPercentage: `${quotaPercentage}%`,
      resetTime: quota.resetTime,
    });

    this.quotaTracker.updateQuota(currentModel, quota);

    if (quota.remainingFraction <= 0) {
      this.logger.warn('HardLimitDetector', 'Model quota exhausted (0%)', {
        model: currentModel,
        resetTime: quota.resetTime,
      });

      const nextModel = this.modelSelector?.selectModel();

      if (!nextModel) {
        this.logger.info('HardLimitDetector', 'No alternative model available, rotating account', {
          currentModel,
        });
        this.rotator.markCurrentExhausted(undefined, quota.resetTime);

        return {
          isExhausted: true,
          shouldRotate: true,
          message: `Model ${currentModel} exhausted (0% quota). Rotated to next account.`,
        };
      }

      this.logger.info('HardLimitDetector', 'Switching to alternative model (exhausted)', {
        fromModel: currentModel,
        toModel: nextModel,
        reason: 'Model exhausted',
      });

      return {
        isExhausted: true,
        shouldRotate: true,
        nextModel,
        message: `Model ${currentModel} exhausted (0% quota). Switching to ${nextModel}.`,
      };
    }

    if (quota.remainingFraction < this.quotaThreshold) {
      this.logger.warn('HardLimitDetector', 'Model below threshold', {
        model: currentModel,
        remainingFraction: quota.remainingFraction,
        quotaPercentage: `${quotaPercentage}%`,
        threshold: this.quotaThreshold,
        thresholdPercentage: `${(this.quotaThreshold * 100).toFixed(1)}%`,
      });

      const nextModel = this.modelSelector?.selectModel();

      if (nextModel && nextModel !== currentModel) {
        this.logger.info('HardLimitDetector', 'Triggering model switch (below threshold)', {
          fromModel: currentModel,
          toModel: nextModel,
          currentQuota: `${quotaPercentage}%`,
          threshold: `${(this.quotaThreshold * 100).toFixed(1)}%`,
          reason: 'Below threshold',
        });

        return {
          isExhausted: false,
          shouldRotate: true,
          nextModel,
          message: `Model ${currentModel} below threshold (${quotaPercentage}%). Switching to ${nextModel}.`,
        };
      } else {
        this.logger.warn('HardLimitDetector', 'Below threshold but no alternative model', {
          model: currentModel,
          quotaPercentage: `${quotaPercentage}%`,
          nextModel,
        });
      }
    } else {
      this.logger.debug('HardLimitDetector', 'Model quota healthy', {
        model: currentModel,
        quotaPercentage: `${quotaPercentage}%`,
        threshold: `${(this.quotaThreshold * 100).toFixed(1)}%`,
      });
    }

    return {
      isExhausted: false,
      shouldRotate: false,
      message: `Model ${currentModel} has ${quotaPercentage}% quota remaining.`,
    };
  }

  async updateAllQuotas(): Promise<void> {
    this.logger.debug('HardLimitDetector', 'Updating all quotas');

    const account = this.rotator.getCurrentAccount();
    if (!account) {
      this.logger.warn('HardLimitDetector', 'Cannot update quotas: no account available');
      return;
    }

    const quotas = await this.apiPoller.getAllQuotas(account);

    this.logger.info('HardLimitDetector', 'Fetched all quotas', {
      accountEmail: account.email,
      modelsCount: quotas.size,
    });

    for (const [model, quota] of quotas.entries()) {
      this.quotaTracker.updateQuota(model, quota);
      this.logger.debug('HardLimitDetector', 'Updated quota for model', {
        model,
        remainingFraction: quota.remainingFraction,
        quotaPercentage: `${(quota.remainingFraction * 100).toFixed(1)}%`,
      });
    }
  }

  setModelRotationStrategy(strategy: ModelRotationStrategy): void {
    this.logger.info('HardLimitDetector', 'Setting model rotation strategy', {
      preferredModels: strategy.preferredModels,
      fallbackModels: strategy.fallbackModels,
      quotaThreshold: strategy.quotaThreshold,
    });
    this.modelSelector = new ModelSelector(this.quotaTracker, strategy);
  }

  getQuotaTracker(): QuotaTracker {
    return this.quotaTracker;
  }

  async rotateAccount(): Promise<void> {
    this.logger.info('HardLimitDetector', 'Manually rotating account');
    this.rotator.markCurrentExhausted();
    this.quotaTracker.clearAll();
  }
}
