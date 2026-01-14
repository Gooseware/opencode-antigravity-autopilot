import { AccountMetadataV3 } from './TokenStorageReader';

export class AccountRotator {
  private accounts: AccountMetadataV3[];
  private activeIndex: number;

  constructor(accounts: AccountMetadataV3[], initialIndex: number) {
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

  public markCurrentExhausted(cooldownMs: number = 0): number {
    if (this.accounts.length === 0) {
        return -1;
    }

    const currentAccount = this.accounts[this.activeIndex];
    currentAccount.coolingDownUntil = Date.now() + cooldownMs;

    this.activeIndex = (this.activeIndex + 1) % this.accounts.length;
    
    return this.activeIndex;
  }
}
