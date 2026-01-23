import { QuotaTracker } from './QuotaTracker';
import { ModelRotationStrategy } from '../types';
import { getLogger } from '../utils/logger';

export class ModelSelector {
  private quotaTracker!: QuotaTracker;
  private strategy!: ModelRotationStrategy;
  private logger!: ReturnType<typeof getLogger>;

  constructor(quotaTracker: QuotaTracker, strategy: ModelRotationStrategy) {
    if (!(this instanceof ModelSelector)) {
      // @ts-ignore
      return new ModelSelector(quotaTracker, strategy);
    }
    this.logger = getLogger();
    this.quotaTracker = quotaTracker;
    this.strategy = strategy || { preferredModels: [], fallbackModels: [], quotaThreshold: 0.02 };

    this.logger.info('ModelSelector', 'Initialized', {
      preferredModelsCount: this.strategy.preferredModels?.length ?? 0,
      fallbackModelsCount: this.strategy.fallbackModels?.length ?? 0,
      quotaThreshold: this.strategy.quotaThreshold,
    });
  }

  selectModel(): string | null {
    this.logger.debug('ModelSelector', 'Selecting model', {
      preferredModels: this.strategy.preferredModels,
      fallbackModels: this.strategy.fallbackModels,
    });

    const preferredModel = this.quotaTracker.getBestAvailableModel(
      this.strategy.preferredModels
    );

    if (preferredModel) {
      this.logger.info('ModelSelector', 'Selected preferred model', { model: preferredModel });
      return preferredModel;
    }

    this.logger.warn('ModelSelector', 'No preferred model available, trying fallbacks');

    const fallbackModel = this.quotaTracker.getBestAvailableModel(
      this.strategy.fallbackModels
    );

    if (fallbackModel) {
      this.logger.info('ModelSelector', 'Selected fallback model', { model: fallbackModel });
    } else {
      this.logger.error('ModelSelector', 'No suitable model found (all exhausted or below threshold)');
    }

    return fallbackModel;
  }

  updateStrategy(strategy: Partial<ModelRotationStrategy>): void {
    this.strategy = { ...this.strategy, ...strategy };
  }

  getStrategy(): ModelRotationStrategy {
    return { ...this.strategy };
  }

  getQuotaStates() {
    return this.quotaTracker.getAllQuotaStates();
  }
}
