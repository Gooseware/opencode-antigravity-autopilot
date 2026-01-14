import { TokenStorageReader } from './auth/TokenStorageReader';
import { AccountRotator } from './auth/AccountRotator';
import { LSPFinder } from './quota/LSPFinder';
import { QuotaPoller, QuotaInfo } from './quota/QuotaPoller';

export async function activate() {
    const tokenReader = new TokenStorageReader();
    const accounts = tokenReader.getAccounts();
    const activeIndex = tokenReader.getActiveIndex();

    const rotator = new AccountRotator(accounts, activeIndex);
    const lspFinder = new LSPFinder();
    const poller = new QuotaPoller();

    // Find the process once at startup
    const lspProcess = await lspFinder.findProcess();

    return {
        async getToken(): Promise<string | null> {
            const account = rotator.getCurrentAccount();
            return account ? account.refreshToken : null;
        },

        async getQuota(): Promise<QuotaInfo | null> {
            if (!lspProcess) {
                return null;
            }
            return poller.checkQuota(lspProcess.port, lspProcess.csrfToken);
        },

        async rotateAccount(): Promise<void> {
            rotator.markCurrentExhausted();
        }
    };
}
