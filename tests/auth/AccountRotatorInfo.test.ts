import { AccountRotator } from '../../src/auth/AccountRotator';

describe('AccountRotator Crash Repro', () => {
    it('should be instantiable without new (legacy support)', () => {
        // @ts-ignore
        const rotator = AccountRotator([], 0);
        expect(rotator).toBeInstanceOf(AccountRotator);
    });

    it('should initialize logger correctly', () => {
        const rotator = new AccountRotator([], 0);
        // @ts-ignore - accessing private property for test
        expect(rotator.logger).toBeDefined();
    });
});
