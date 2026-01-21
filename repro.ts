
import { AccountRotator } from './src/auth/AccountRotator';
import { AccountMetadataV3 } from './src/auth/TokenStorageReader';

const accounts: AccountMetadataV3[] = [{
    refreshToken: 'test',
    email: 'test@example.com',
    addedAt: Date.now(),
    lastUsed: 0,
}];

try {
    const rotator = new AccountRotator(accounts, 0);
    console.log('AccountRotator instantiated successfully');
    console.log('Current account:', rotator.getCurrentAccount()?.email);
} catch (e) {
    console.error('Error instantiating AccountRotator:', e);
}
