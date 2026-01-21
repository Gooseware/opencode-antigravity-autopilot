import { QuotaTracker } from './QuotaTracker';
import { ModelRotationStrategy } from '../types';

export class ModelSelector {
  private quotaTracker!: QuotaTracker;
  private strategy!: ModelRotationStrategy;

  constructor(quotaTracker: QuotaTracker, strategy: ModelRotationStrategy) {
    if (!(this instanceof ModelSelector)) {
      // @ts-ignore
      return new ModelSelector(quotaTracker, strategy);
    }
    this.quotaTracker = quotaTracker;
    this.strategy = strategy;
  }

  selectModel(): string | null {
    const preferredModel = this.quotaTracker.getBestAvailableModel(
      this.strategy.preferredModels
    );

    if (preferredModel) {
      return preferredModel;
    }

    const fallbackModel = this.quotaTracker.getBestAvailableModel(
      this.strategy.fallbackModels
    );

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
