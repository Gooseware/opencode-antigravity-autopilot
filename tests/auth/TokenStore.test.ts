import { TokenStore } from '../../src/auth/TokenStore';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

describe('TokenStore', () => {
  it('should save tokens with 600 permissions', () => {
    const store = new TokenStore();
    store.saveTokens([{ refresh_token: 'abc' }]);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('antigravity-accounts.json'),
      expect.any(String),
      expect.objectContaining({ mode: 0o600 })
    );
  });
});
