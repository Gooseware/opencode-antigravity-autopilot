
import { activate } from '../src/index';
import { TokenStorageReader } from '../src/auth/TokenStorageReader';
import { AccountRotator } from '../src/auth/AccountRotator';
import { LSPFinder } from '../src/quota/LSPFinder';
import { QuotaPoller } from '../src/quota/QuotaPoller';

// Mock dependencies
jest.mock('../src/auth/TokenStorageReader');
jest.mock('../src/auth/AccountRotator');
jest.mock('../src/quota/LSPFinder');
jest.mock('../src/quota/QuotaPoller');

describe('Integration (src/index)', () => {
    // Mock instances
    let mockTokenReader: jest.Mocked<TokenStorageReader>;
    let mockRotator: jest.Mocked<AccountRotator>;
    let mockLSPFinder: jest.Mocked<LSPFinder>;
    let mockPoller: jest.Mocked<QuotaPoller>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup mock implementations
        mockTokenReader = new TokenStorageReader() as jest.Mocked<TokenStorageReader>;
        mockRotator = new AccountRotator([], 0) as jest.Mocked<AccountRotator>;
        mockLSPFinder = new LSPFinder() as jest.Mocked<LSPFinder>;
        mockPoller = new QuotaPoller() as jest.Mocked<QuotaPoller>;

        (TokenStorageReader as jest.Mock).mockReturnValue(mockTokenReader);
        (AccountRotator as jest.Mock).mockReturnValue(mockRotator);
        (LSPFinder as jest.Mock).mockReturnValue(mockLSPFinder);
        (QuotaPoller as jest.Mock).mockReturnValue(mockPoller);

        // Default behaviors
        mockTokenReader.getAccounts.mockReturnValue([
            { email: 'test@example.com', refreshToken: 'refresh-1' }
        ]);
        mockTokenReader.getActiveIndex.mockReturnValue(0);
        
        mockRotator.getCurrentAccount.mockReturnValue({
             email: 'test@example.com', refreshToken: 'refresh-1'
        });

        mockLSPFinder.findProcess.mockResolvedValue({ pid: 123, port: 12345, csrfToken: 'csrf-123' });

        mockPoller.checkQuota.mockResolvedValue({
            remainingFraction: 0.5,
            resetTime: '2024-01-01T00:00:00Z'
        });
    });

    test('activate initializes components and returns API', async () => {
        const api = await activate();

        expect(TokenStorageReader).toHaveBeenCalled();
        expect(mockTokenReader.getAccounts).toHaveBeenCalled();
        expect(mockTokenReader.getActiveIndex).toHaveBeenCalled();
        
        expect(AccountRotator).toHaveBeenCalled();
        expect(LSPFinder).toHaveBeenCalled();
        expect(mockLSPFinder.findProcess).toHaveBeenCalled();
        
        expect(QuotaPoller).toHaveBeenCalled();
        
        expect(api).toHaveProperty('getToken');
        expect(api).toHaveProperty('getQuota');
        expect(api).toHaveProperty('rotateAccount');
    });

    test('getToken returns current refresh token', async () => {
        const api = await activate();
        const token = await api.getToken();
        expect(token).toBe('refresh-1');
        expect(mockRotator.getCurrentAccount).toHaveBeenCalled();
    });

    test('getToken returns null if no account', async () => {
        mockRotator.getCurrentAccount.mockReturnValue(null);
        const api = await activate();
        const token = await api.getToken();
        expect(token).toBeNull();
    });

    test('getQuota returns quota data', async () => {
        const api = await activate();
        const quota = await api.getQuota();
        
        expect(quota).toEqual({
            remainingFraction: 0.5,
            resetTime: '2024-01-01T00:00:00Z'
        });
        
        // Verify it used the correct params from LSPFinder
        expect(mockPoller.checkQuota).toHaveBeenCalledWith(12345, 'csrf-123');
    });

    test('getQuota returns null if LSP not found', async () => {
        mockLSPFinder.findProcess.mockResolvedValue(null);
        
        const api = await activate();
        const quota = await api.getQuota();
        
        expect(quota).toBeNull();
        expect(mockPoller.checkQuota).not.toHaveBeenCalled();
    });

    test('rotateAccount triggers rotation', async () => {
        const api = await activate();
        await api.rotateAccount();
        expect(mockRotator.markCurrentExhausted).toHaveBeenCalled();
    });
});
