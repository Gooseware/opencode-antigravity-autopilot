import { QuotaInfo, ModelQuotaState } from '../types';
import { getLogger } from '../utils/logger';

export class QuotaTracker {
  private quotaState!: Map<string, ModelQuotaState>;
  private quotaThreshold!: number;
  private logger!: ReturnType<typeof getLogger>;

  constructor(quotaThreshold: number = 0.02) {
    if (!(this instanceof QuotaTracker)) {
      // @ts-ignore
      return new QuotaTracker(quotaThreshold);
    }
    this.logger = getLogger();
    this.quotaState = new Map();
    this.quotaThreshold = quotaThreshold;

    this.logger.info('QuotaTracker', 'Initialized', {
      quotaThreshold,
      thresholdPercentage: `${(quotaThreshold * 100).toFixed(1)}%`,
    });
  }

  updateQuota(model: string, quota: QuotaInfo): void {
    const previousState = this.quotaState.get(model);
    const newState: ModelQuotaState = {
      model,
      quotaFraction: quota.remainingFraction,
      lastChecked: Date.now(),
      resetTime: quota.resetTime,
    };

    this.quotaState.set(model, newState);

    this.logger.debug('QuotaTracker', 'Quota updated', {
      model,
      previousFraction: previousState?.quotaFraction,
      newFraction: quota.remainingFraction,
      quotaPercentage: `${(quota.remainingFraction * 100).toFixed(1)}%`,
      threshold: `${(this.quotaThreshold * 100).toFixed(1)}%`,
      isAboveThreshold: quota.remainingFraction >= this.quotaThreshold,
    });
  }

  getQuotaForModel(model: string): ModelQuotaState | null {
    return this.quotaState.get(model) || null;
  }

  getThreshold(): number {
    return this.quotaThreshold;
  }

  isModelAvailable(model: string): boolean {
    const state = this.quotaState.get(model);
    if (!state) return true;

    if (state.quotaFraction < this.quotaThreshold) {
      return false;
    }

    return true;
  }

  getBestAvailableModel(candidates: string[]): string | null {
    this.logger.debug('QuotaTracker', 'Finding best available model (highest quota)', {
      candidatesCount: candidates.length,
      candidates,
    });

    let bestModel: string | null = null;
    let maxQuota = -1;

    for (const model of candidates) {
      if (this.isModelAvailable(model)) {
        const state = this.quotaState.get(model);
        // Default to 1.0 (100%) if we haven't checked this model yet
        const quotaFraction = state ? state.quotaFraction : 1.0;
        
        if (quotaFraction > maxQuota) {
          maxQuota = quotaFraction;
          bestModel = model;
        }
      }
    }

    if (bestModel) {
      const state = this.quotaState.get(bestModel);
      const quotaPercentage = state ? `${(state.quotaFraction * 100).toFixed(1)}%` : 'unknown (assumed healthy)';
      
      this.logger.info('QuotaTracker', 'Selected model with highest availability', {
        model: bestModel,
        quotaPercentage,
      });
      return bestModel;
    }

    this.logger.warn('QuotaTracker', 'No available model found among candidates', {
      candidatesCount: candidates.length,
    });

    return null;
  }

  getAllQuotaStates(): ModelQuotaState[] {
    return Array.from(this.quotaState.values());
  }

  clearStaleData(maxAgeMs: number = 300000): void {
    const now = Date.now();
    for (const [model, state] of this.quotaState.entries()) {
      if (now - state.lastChecked > maxAgeMs) {
        this.quotaState.delete(model);
      }
    }
  }

  clearAll(): void {
    const count = this.quotaState.size;
    this.quotaState.clear();
    this.logger.info('QuotaTracker', 'Cleared all quota states', { clearedCount: count });
  }
}
