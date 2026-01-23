import type { AccountMetadataV3 } from '../types';
import fs from 'fs';

const LOG_FILE = '/tmp/autopilot.log';
function logToFile(message: string): void {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

// Import types and utilities from opencode-antigravity-quota
interface CloudCodeQuotaInfo {
  remainingFraction?: number;
  resetTime?: string;
}

interface CloudCodeModelInfo {
  displayName?: string;
  model?: string;
  quotaInfo?: CloudCodeQuotaInfo;
  supportsImages?: boolean;
  supportsVideo?: boolean;
  supportsThinking?: boolean;
  recommended?: boolean;
  tagTitle?: string;
}

interface CloudCodeQuotaResponse {
  models?: Record<string, CloudCodeModelInfo>;
}

interface LoadCodeAssistResponse {
  currentTier?: { id?: string };
  paidTier?: { id?: string };
  cloudaicompanionProject?: unknown;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface QuotaInfo {
  remainingFraction: number;
  resetTime?: string;
  model?: string;
}

export interface ModelQuotaInfo {
  model: string;
  displayName: string;
  remainingFraction: number;
  isExhausted: boolean;
  resetTime?: string;
}

const ANTIGRAVITY_CLIENT_ID = '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com';
const ANTIGRAVITY_CLIENT_SECRET = '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';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CLOUDCODE_BASE_URL = 'https://cloudcode-pa.googleapis.com';
const CLOUDCODE_METADATA = {
  ideType: 'ANTIGRAVITY',
  platform: 'PLATFORM_UNSPECIFIED',
  pluginType: 'GEMINI',
};

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}



export class ApiQuotaPoller {
  constructor() {
    if (!(this instanceof ApiQuotaPoller)) {
      // @ts-ignore
      return new ApiQuotaPoller();
    }
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    const params = new URLSearchParams({
      client_id: ANTIGRAVITY_CLIENT_ID,
      client_secret: ANTIGRAVITY_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: controller.signal,
      });

      if (!response.ok) {
        logToFile(`Token refresh failed: ${response.status}`);
        if (response.status === 401 || response.status === 403) {
          throw new AuthenticationError(`Token refresh failed (${response.status})`);
        }
        throw new Error(`Token refresh failed (${response.status})`);
      }

      const data = (await response.json()) as TokenResponse;
      return data.access_token;
    } catch (e: any) {
      logToFile(`Token refresh error: ${e.message}`);
      throw e;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async loadCodeAssist(accessToken: string): Promise<LoadCodeAssistResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${CLOUDCODE_BASE_URL}/v1internal:loadCodeAssist`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'antigravity',
        },
        body: JSON.stringify({ metadata: CLOUDCODE_METADATA }),
        signal: controller.signal,
      });

      if (!response.ok) {
        logToFile(`loadCodeAssist failed: ${response.status}`);
        throw new Error(`loadCodeAssist failed (${response.status})`);
      }
      return (await response.json()) as LoadCodeAssistResponse;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractProjectId(cloudaicompanionProject: unknown): string | undefined {
    if (!cloudaicompanionProject) return undefined;
    if (typeof cloudaicompanionProject === 'string') {
      const match = cloudaicompanionProject.match(/projects\/([^/]+)/);
      return match ? match[1] : undefined;
    }
    return undefined;
  }

  private async fetchAvailableModels(
    accessToken: string,
    projectId?: string
  ): Promise<CloudCodeQuotaResponse> {
    const payload = projectId ? { project: projectId } : {};
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${CLOUDCODE_BASE_URL}/v1internal:fetchAvailableModels`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'antigravity',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        logToFile(`fetchAvailableModels failed: ${response.status}`);
        throw new Error(`fetchModels failed (${response.status})`);
      }
      return (await response.json()) as CloudCodeQuotaResponse;
    } finally {
      clearTimeout(timeout);
    }
  }

  async checkQuota(account: AccountMetadataV3): Promise<ModelQuotaInfo[]> {
    try {
      const accessToken = await this.refreshAccessToken(account.refreshToken);
      let projectId = account.projectId || account.managedProjectId;

      if (!projectId) {
        const codeAssist = await this.loadCodeAssist(accessToken);
        projectId = this.extractProjectId(codeAssist.cloudaicompanionProject);
      }

      const quotaResponse = await this.fetchAvailableModels(accessToken, projectId);
      if (!quotaResponse.models) return [];

      const models: ModelQuotaInfo[] = [];

      for (const [modelKey, info] of Object.entries(quotaResponse.models)) {
        const quotaInfo = info.quotaInfo;
        if (!quotaInfo) continue;

        const label = info.displayName || modelKey;
        const lowerLabel = label.toLowerCase();

        // Filter out unwanted models
        if (
          lowerLabel.startsWith('chat_') ||
          lowerLabel.startsWith('rev19') ||
          lowerLabel.includes('gemini 2.5') ||
          lowerLabel.includes('gemini 3 pro image')
        ) {
          continue;
        }

        const remainingFraction = Math.min(1, Math.max(0, quotaInfo.remainingFraction ?? 0));

        models.push({
          model: info.model || modelKey,
          displayName: label,
          remainingFraction,
          isExhausted: remainingFraction <= 0,
          resetTime: quotaInfo.resetTime,
        });
      }

      return models;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      logToFile(`Failed to check quota via API: ${error}`);
      return [];
    }
  }

  async checkQuotaForModel(account: AccountMetadataV3, modelName: string): Promise<QuotaInfo | null> {
    const models = await this.checkQuota(account);

    // Try exact match first
    let model = models.find(m => m.model === modelName || m.displayName === modelName);

    // Try partial match (e.g., "gemini-3-pro" matches "Gemini 3 Pro")
    if (!model) {
      const normalizedSearch = modelName.toLowerCase().replace(/[-_]/g, ' ');
      model = models.find(m =>
        m.model.toLowerCase().includes(normalizedSearch) ||
        m.displayName.toLowerCase().includes(normalizedSearch)
      );
    }

    if (!model) return null;

    return {
      remainingFraction: model.remainingFraction,
      resetTime: model.resetTime,
      model: model.model,
    };
  }

  async getAllQuotas(account: AccountMetadataV3): Promise<Map<string, QuotaInfo>> {
    const models = await this.checkQuota(account);
    const quotaMap = new Map<string, QuotaInfo>();

    for (const model of models) {
      quotaMap.set(model.model, {
        remainingFraction: model.remainingFraction,
        resetTime: model.resetTime,
        model: model.model,
      });

      // Also add by display name for easier lookup
      quotaMap.set(model.displayName, {
        remainingFraction: model.remainingFraction,
        resetTime: model.resetTime,
        model: model.model,
      });
    }

    return quotaMap;
  }
}
