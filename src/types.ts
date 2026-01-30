export interface QuotaInfo {
  remainingFraction: number;
  resetTime?: string;
  model?: string;
}

export interface AccountMetadataV3 {
  refreshToken: string;
  email?: string;
  addedAt?: number;
  lastUsed?: number;
  coolingDownUntil?: number;
  projectId?: string;
  managedProjectId?: string;
  rateLimitResetTimes?: Record<string, number>;
}

export interface AccountStorageV3 {
  version: number;
  accounts: AccountMetadataV3[];
  activeIndex: number;
  activeIndexByFamily?: {
    claude?: number;
    gemini?: number;
    antigravity?: number;
  };
}

export interface ModelQuotaState {
  model: string;
  quotaFraction: number;
  lastChecked: number;
  resetTime?: string;
}

export type ModelFamily = 'claude' | 'gemini';

export interface ModelRotationStrategy {
  preferredModels: string[];
  fallbackModels: string[];
  quotaThreshold: number;
}

export interface QuotaCache {
  percentage: number;
  quotaUsed: number;
  model: string;
  timestamp: number;
  refreshDate: string;
  humanReadable: string;
}

export interface PluginConfig {
  quotaThreshold?: number;
  pollIntervalMs?: number;
  enableRotation?: boolean;
  preferredModels?: string[];
}
