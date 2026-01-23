import { TokenStorageReader } from './auth/TokenStorageReader';
import { AccountRotator } from './auth/AccountRotator';
import { LSPFinder } from './quota/LSPFinder';
import { QuotaPoller, QuotaInfo } from './quota/QuotaPoller';
import { ApiQuotaPoller, AuthenticationError } from './quota/ApiQuotaPoller';
import { QuotaTracker } from './rotation/QuotaTracker';
import { ModelSelector } from './rotation/ModelSelector';
import { PluginConfig, ModelRotationStrategy } from './types';
import { writeQuotaToCache } from './quota/QuotaCacheUpdater';
import { getLogger } from './utils/logger';

const MIN_POLL_INTERVAL_MS = 60 * 1000; // Minimum 60 seconds between API calls

export class QuotaManager {
  private tokenReader!: TokenStorageReader;
  private rotator!: AccountRotator;
  private lspFinder!: LSPFinder;
  private poller!: QuotaPoller;
  private apiPoller!: ApiQuotaPoller;
  private quotaTracker!: QuotaTracker;
  private modelSelector!: ModelSelector | null;
  private lspProcess!: { pid: number; csrfToken: string; port: number } | null;
  private lastSelectedModel!: string | null;
  private logger!: ReturnType<typeof getLogger>;

  // Rate limiting cache
  private lastAllQuotasFetch!: number;
  private cachedAllQuotas!: Map<string, QuotaInfo> | null;
  private lastSingleQuotaFetch!: number;
  private cachedSingleQuota!: QuotaInfo | null;

  constructor(config?: PluginConfig) {
    if (!(this instanceof QuotaManager)) {
      // @ts-ignore
      return new QuotaManager(config);
    }
    this.logger = getLogger();

    // Initialize cache
    this.lastAllQuotasFetch = 0;
    this.cachedAllQuotas = null;
    this.lastSingleQuotaFetch = 0;
    this.cachedSingleQuota = null;

    this.lastSelectedModel = null;
    this.modelSelector = null;
    this.lspProcess = null;
    this.tokenReader = new TokenStorageReader();
    const accounts = this.tokenReader.getAccounts();
    const activeIndex = this.tokenReader.getActiveIndex();

    this.rotator = new AccountRotator(accounts, activeIndex);
    this.lspFinder = new LSPFinder();
    this.poller = new QuotaPoller();
    this.apiPoller = new ApiQuotaPoller();
    this.quotaTracker = new QuotaTracker(config?.quotaThreshold || 0.02);

    this.logger.info('QuotaManager', 'Initialized', {
      quotaThreshold: config?.quotaThreshold || 0.02,
      accountsCount: accounts.length,
      activeIndex,
      preferredModelsCount: config?.preferredModels?.length || 0,
    });

    if (config?.preferredModels) {
      const strategy: ModelRotationStrategy = {
        preferredModels: config.preferredModels,
        fallbackModels: [],
        quotaThreshold: config.quotaThreshold || 0.02,
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

  async getQuotaViaApi(modelName?: string, retries = 3): Promise<QuotaInfo | null> {
    const now = Date.now();

    // Rate limiting: return cached result if called too soon
    if (this.cachedSingleQuota && (now - this.lastSingleQuotaFetch) < MIN_POLL_INTERVAL_MS) {
      return this.cachedSingleQuota;
    }

    const account = this.rotator.getCurrentAccount();
    if (!account) {
      this.logger.warn('QuotaManager', 'No account available for quota fetch');
      return null;
    }

    this.logger.debug('QuotaManager', 'Fetching quota via API', {
      modelName: modelName || this.lastSelectedModel || 'all',
      accountEmail: account.email,
      retriesLeft: retries,
    });

    try {
      let result: QuotaInfo | null = null;
      const targetModel = modelName || this.lastSelectedModel;

      if (targetModel) {
        this.logger.debug('QuotaManager', 'Fetching quota for specific model', { model: targetModel });
        result = await this.apiPoller.checkQuotaForModel(account, targetModel);
      } else {
        this.logger.debug('QuotaManager', 'Fetching all quotas');
        const quotas = await this.apiPoller.getAllQuotas(account);
        if (quotas.size === 0) {
          this.logger.warn('QuotaManager', 'No quotas returned from API');
          return null;
        }
        result = quotas.values().next().value || null;
      }

      if (result) {
        this.lastSingleQuotaFetch = Date.now();
        this.cachedSingleQuota = result;
        this.logger.info('QuotaManager', 'Quota fetched successfully', {
          model: result.model,
          remainingFraction: result.remainingFraction,
          quotaPercentage: `${(result.remainingFraction * 100).toFixed(1)}%`,
        });
        await writeQuotaToCache(result);
      }
      return result;

    } catch (error) {
      this.logger.error('QuotaManager', 'Error fetching quota', { error, retriesLeft: retries });
      if (error instanceof AuthenticationError && retries > 0) {
        this.logger.info('QuotaManager', 'Authentication failed, rotating account', { retriesLeft: retries - 1 });
        await this.rotateAccount();
        return this.getQuotaViaApi(modelName, retries - 1);
      }
      throw error;
    }
  }

  async getAllQuotasViaApi(retries = 3): Promise<Map<string, QuotaInfo>> {
    const now = Date.now();

    // Rate limiting: return cached result if called too soon
    if (this.cachedAllQuotas && (now - this.lastAllQuotasFetch) < MIN_POLL_INTERVAL_MS) {
      return this.cachedAllQuotas;
    }

    const account = this.rotator.getCurrentAccount();
    if (!account) {
      this.logger.warn('QuotaManager', 'No account available for getAllQuotas');
      return new Map();
    }

    this.logger.debug('QuotaManager', 'Fetching all quotas via API', {
      accountEmail: account.email,
      retriesLeft: retries,
    });

    try {
      const quotas = await this.apiPoller.getAllQuotas(account);

      this.lastAllQuotasFetch = Date.now();
      this.cachedAllQuotas = quotas;

      this.logger.info('QuotaManager', 'All quotas fetched successfully', {
        modelsCount: quotas.size,
      });

      const first = quotas.values().next().value;
      if (first) {
        await writeQuotaToCache(first);
      }
      return quotas;
    } catch (error) {
      this.logger.error('QuotaManager', 'Error fetching all quotas', { error, retriesLeft: retries });
      if (error instanceof AuthenticationError && retries > 0) {
        this.logger.info('QuotaManager', 'Authentication failed, rotating account', { retriesLeft: retries - 1 });
        await this.rotateAccount();
        return this.getAllQuotasViaApi(retries - 1);
      }
      throw error;
    }
  }

  async rotateAccount(resetTimeISO?: string): Promise<void> {
    this.logger.info('QuotaManager', 'Rotating account', { resetTimeISO });
    this.rotator.markCurrentExhausted(undefined, resetTimeISO);
    this.quotaTracker.clearAll();

    const newAccount = this.rotator.getCurrentAccount();
    this.logger.info('QuotaManager', 'Account rotated', {
      newAccountEmail: newAccount?.email,
    });
  }

  selectBestModel(): string | null {
    const model = this.modelSelector?.selectModel() || null;
    if (model) {
      this.logger.info('QuotaManager', 'Best model selected', { model });
      this.lastSelectedModel = model;
    } else {
      this.logger.warn('QuotaManager', 'No suitable model found');
    }
    return model;
  }

  updateQuotaForModel(model: string, quota: QuotaInfo): void {
    this.quotaTracker.updateQuota(model, quota);
  }

  getQuotaTracker(): QuotaTracker {
    return this.quotaTracker;
  }

  setModelRotationStrategy(strategy: ModelRotationStrategy): void {
    this.logger.info('QuotaManager', 'Setting model rotation strategy', {
      preferredModels: strategy.preferredModels,
      fallbackModels: strategy.fallbackModels,
      quotaThreshold: strategy.quotaThreshold,
    });
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
