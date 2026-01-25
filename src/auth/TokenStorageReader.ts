import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getLogger } from '../utils/logger';

export interface AccountMetadataV3 {
  refreshToken: string;
  email: string;
  addedAt?: number;
  lastUsed?: number;
  coolingDownUntil?: number;
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

export class TokenStorageReader {
  private accounts!: AccountMetadataV3[];
  private activeIndex!: number;
  private activeIndexByFamily?: { claude?: number; gemini?: number; antigravity?: number };
  private logger!: import('../utils/logger').AutopilotLogger;

  constructor() {
    if (!(this instanceof TokenStorageReader)) {
      // @ts-ignore
      return new TokenStorageReader();
    }
    this.logger = getLogger();
    this.accounts = [];
    this.activeIndex = -1;
    this.load();
  }

  public getAccounts(): AccountMetadataV3[] {
    return this.accounts;
  }

  public getActiveIndex(): number {
    return this.activeIndex;
  }

  public getActiveIndexByFamily() {
    return this.activeIndexByFamily;
  }

  private load(): void {
    const storagePath = this.getStoragePath();

    if (!fs.existsSync(storagePath)) {
      this.logger.warn('TokenStorageReader', `Token storage file not found at ${storagePath}`);
      return;
    }

    try {
      const content = fs.readFileSync(storagePath, 'utf-8');
      const data = JSON.parse(content);

      if (data.version !== 3) {
        this.logger.warn('TokenStorageReader', `Unsupported storage version: ${data.version}. Expected version 3.`);
        return;
      }

      const storage = data as AccountStorageV3;
      this.accounts = storage.accounts || [];
      this.activeIndex = storage.activeIndex ?? -1;
      this.activeIndexByFamily = storage.activeIndexByFamily;

    } catch (error) {
      this.logger.error('TokenStorageReader', 'Failed to parse token storage file', error);
    }
  }

  private getStoragePath(): string {
    const xdgConfigHome = process.env.XDG_CONFIG_HOME;
    if (xdgConfigHome) {
      return path.join(xdgConfigHome, 'opencode', 'antigravity-accounts.json');
    }

    const homeDir = os.homedir();
    return path.join(homeDir, '.config', 'opencode', 'antigravity-accounts.json');
  }
}
