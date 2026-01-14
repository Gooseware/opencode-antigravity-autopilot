import { AccountRotator } from '../../src/auth/AccountRotator';
import { AccountMetadataV3 } from '../../src/auth/TokenStorageReader';

describe('AccountRotator', () => {
  const createAccount = (token: string, coolingDownUntil?: number): AccountMetadataV3 => ({
    refreshToken: token,
    email: `${token}@example.com`,
    addedAt: 0,
    lastUsed: 0,
    coolingDownUntil
  });

  it('should return the account at the initial index', () => {
    const accounts = [createAccount('t1'), createAccount('t2')];
    const rotator = new AccountRotator(accounts, 0);
    expect(rotator.getCurrentAccount()?.refreshToken).toBe('t1');
  });

  it('should rotate to next account when marked exhausted', () => {
    const accounts = [createAccount('t1'), createAccount('t2')];
    const rotator = new AccountRotator(accounts, 0); 
    
    expect(rotator.getCurrentAccount()?.refreshToken).toBe('t1');
    
    rotator.markCurrentExhausted(10000);
    
    expect(rotator.getCurrentAccount()?.refreshToken).toBe('t2');
  });

  it('should wrap around when rotating', () => {
    const accounts = [createAccount('t1'), createAccount('t2')];
    const rotator = new AccountRotator(accounts, 1);
    
    expect(rotator.getCurrentAccount()?.refreshToken).toBe('t2');
    
    rotator.markCurrentExhausted(10000);
    
    expect(rotator.getCurrentAccount()?.refreshToken).toBe('t1');
  });

  it('should skip cooled down accounts', () => {
     const future = Date.now() + 10000;
     const accounts = [
        createAccount('t1', future),
        createAccount('t2')
     ];
     const rotator = new AccountRotator(accounts, 0);
     expect(rotator.getCurrentAccount()?.refreshToken).toBe('t2');
  });

  it('should return account with soonest expiry if ALL are cooling down', () => {
    const now = Date.now();
    const accounts = [
       createAccount('t1', now + 20000), 
       createAccount('t2', now + 10000)
    ];
    const rotator = new AccountRotator(accounts, 0);
    
    expect(rotator.getCurrentAccount()?.refreshToken).toBe('t2');
  });

  it('should handle empty account list', () => {
      const rotator = new AccountRotator([], 0);
      expect(rotator.getCurrentAccount()).toBeNull();
  });

  it('should handle markCurrentExhausted with empty account list', () => {
    const rotator = new AccountRotator([], 0);
    expect(rotator.markCurrentExhausted(1000)).toBe(-1);
  });

  it('should return first account if all accounts have Infinity cooldown', () => {
    const accounts = [
       createAccount('t1', Infinity), 
       createAccount('t2', Infinity)
    ];
    
    const rotator = new AccountRotator(accounts, 1);
    expect(rotator.getCurrentAccount()?.refreshToken).toBe('t2');
  });

  it('should not be affected by external modification of accounts array', () => {
      const accounts = [createAccount('t1')];
      const rotator = new AccountRotator(accounts, 0);
      
      accounts.pop();
      
      expect(rotator.getCurrentAccount()?.refreshToken).toBe('t1');
  });
});
