import { AccountMetadataV3, AccountStorageV3 } from './TokenStorageReader';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class AccountRotator {
  private accounts!: AccountMetadataV3[];
  private activeIndex!: number;

  constructor(accounts: AccountMetadataV3[], initialIndex: number) {
    if (!(this instanceof AccountRotator)) {
      // @ts-ignore
      return new AccountRotator(accounts, initialIndex);
    }
    this.accounts = [...accounts];
    this.activeIndex = initialIndex;
  }

  public getCurrentAccount(): AccountMetadataV3 | null {
    if (this.accounts.length === 0) {
      return null;
    }

    const count = this.accounts.length;
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      const index = (this.activeIndex + i) % count;
      const account = this.accounts[index];

      if (!account.coolingDownUntil || account.coolingDownUntil <= now) {
        this.activeIndex = index;
        return account;
      }
    }

    let minCooldown = Infinity;
    let minIndex = -1;

    for (let i = 0; i < count; i++) {
      const account = this.accounts[i];
      if (account.coolingDownUntil && account.coolingDownUntil < minCooldown) {
        minCooldown = account.coolingDownUntil;
        minIndex = i;
      }
    }

    if (minIndex !== -1) {
      this.activeIndex = minIndex;
      return this.accounts[minIndex];
    }

    return this.accounts[this.activeIndex];
  }

  public markCurrentExhausted(cooldownMs?: number, resetTimeISO?: string): number {
    if (this.accounts.length === 0) {
      return -1;
    }

    const currentAccount = this.accounts[this.activeIndex];
    
    if (resetTimeISO) {
      const resetTime = new Date(resetTimeISO);
      if (!Number.isNaN(resetTime.getTime())) {
        currentAccount.coolingDownUntil = resetTime.getTime();
      } else {
        currentAccount.coolingDownUntil = Date.now() + (cooldownMs || 30 * 60 * 1000);
      }
    } else {
      currentAccount.coolingDownUntil = Date.now() + (cooldownMs || 30 * 60 * 1000);
    }

    this.activeIndex = (this.activeIndex + 1) % this.accounts.length;

    this.saveToDisk();

    return this.activeIndex;
  }

  private saveToDisk(): void {
    const storagePath = this.getStoragePath();

    // Ensure directory exists
    const dir = path.dirname(storagePath);
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (error) {
        console.error('Failed to create config directory:', error);
        return;
      }
    }

    const storage: AccountStorageV3 = {
      version: 3,
      accounts: this.accounts,
      activeIndex: this.activeIndex
    };

    try {
      fs.writeFileSync(storagePath, JSON.stringify(storage, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save account storage:', error);
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
