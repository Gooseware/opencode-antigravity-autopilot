import { AccountRotator } from '../../src/auth/AccountRotator';
import { AccountMetadataV3 } from '../../src/auth/TokenStorageReader';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('path');

describe('AccountRotator', () => {
    let mockAccounts: AccountMetadataV3[];

    beforeEach(() => {
        jest.clearAllMocks();
        mockAccounts = [
            { refreshToken: 'token1', email: 'user1@test.com' },
            { refreshToken: 'token2', email: 'user2@test.com' }
        ];
        (path.join as jest.Mock).mockReturnValue('/mock/path/antigravity-accounts.json');
        (path.dirname as jest.Mock).mockReturnValue('/mock/path');
        (fs.existsSync as jest.Mock).mockReturnValue(true);
    });

    it('should rotate account and save to disk when current is exhausted', () => {
        const rotator = new AccountRotator(mockAccounts, 0);

        // Initial state
        expect(rotator.getCurrentAccount()?.refreshToken).toBe('token1');

        // Rotate
        const newIndex = rotator.markCurrentExhausted();

        // Verify rotation
        expect(newIndex).toBe(1);
        expect(rotator.getCurrentAccount()?.refreshToken).toBe('token2');

        // Verify save to disk
        expect(fs.writeFileSync).toHaveBeenCalled();
        const callArgs = (fs.writeFileSync as jest.Mock).mock.calls[0];
        const savedData = JSON.parse(callArgs[1]);

        expect(savedData.activeIndex).toBe(1);
        expect(savedData.accounts[0].coolingDownUntil).toBeDefined();
    });

    it('should handle single account rotation', () => {
        const rotator = new AccountRotator([mockAccounts[0]], 0);

        const newIndex = rotator.markCurrentExhausted();

        expect(newIndex).toBe(0);
        expect(fs.writeFileSync).toHaveBeenCalled();

        const callArgs = (fs.writeFileSync as jest.Mock).mock.calls[0];
        const savedData = JSON.parse(callArgs[1]);

        expect(savedData.activeIndex).toBe(0);
    });
});
