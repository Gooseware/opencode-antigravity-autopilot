import { QuotaInfo, ModelQuotaState } from '../types';

export class QuotaTracker {
  private quotaState: Map<string, ModelQuotaState> = new Map();
  private readonly quotaThreshold: number;

  constructor(quotaThreshold: number = 0.2) {
    this.quotaThreshold = quotaThreshold;
  }

  updateQuota(model: string, quota: QuotaInfo): void {
    this.quotaState.set(model, {
      model,
      quotaFraction: quota.remainingFraction,
      lastChecked: Date.now(),
      resetTime: quota.resetTime,
    });
  }

  getQuotaForModel(model: string): ModelQuotaState | null {
    return this.quotaState.get(model) || null;
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
    let bestModel: string | null = null;
    let bestQuota = -1;

    for (const model of candidates) {
      if (!this.isModelAvailable(model)) continue;

      const state = this.quotaState.get(model);
      const quota = state?.quotaFraction ?? 1.0;

      if (quota > bestQuota) {
        bestQuota = quota;
        bestModel = model;
      }
    }

    return bestModel;
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
    this.quotaState.clear();
  }
}
