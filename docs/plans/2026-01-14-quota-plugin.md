# Antigravity Quota Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement `opencode-antigravity-quota` plugin to enable OpenCode to use Antigravity quota pool via OAuth 2.0 and provide real-time quota telemetry.

**Architecture:** A Node.js based plugin with an Authentication Module (OAuth flow, Token Storage), Quota Acquisition Module (LSP Sniffing, Remote Header Inspection), and an Account Rotation "Load Balancer".

**Tech Stack:** TypeScript, Node.js (fs, child_process, http), Jest (testing), Axios (HTTP requests).

### Task 1: Project Skeleton & Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `jest.config.js`
- Create: `src/index.ts`
- Test: `tests/index.test.ts`

**Step 1: Write failing test**
```typescript
// tests/index.test.ts
import { activate } from '../src/index';

describe('Plugin Activation', () => {
  it('should be defined', () => {
    expect(activate).toBeDefined();
  });
});
```

**Step 2: Run test (Verify Failure)**
Run: `npm test`
Expected: FAIL (Cannot find module)

**Step 3: Implementation**
- Initialize `package.json` with `npm init -y`
- Install dev dependencies: `typescript`, `jest`, `ts-jest`, `@types/jest`, `@types/node`
- Configure `tsconfig.json` and `jest.config.js`
- Create `src/index.ts` with empty `activate` function.

**Step 4: Run test (Verify Pass)**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```bash
git add .
git commit -m "chore: setup project skeleton"
```

### Task 2: Token Storage Manager

**Files:**
- Create: `src/auth/TokenStore.ts`
- Test: `tests/auth/TokenStore.test.ts`

**Step 1: Write failing test**
```typescript
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
```

**Step 2: Run test**
Run: `npm test`
Expected: FAIL

**Step 3: Implementation**
- Implement `TokenStore` class.
- Method `saveTokens(tokens: any[])`: write to `~/.config/opencode/antigravity-accounts.json` with mode `0o600`.
- Method `loadTokens()`: read and parse JSON.

**Step 4: Run test**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```bash
git add src/auth/TokenStore.ts tests/auth/TokenStore.test.ts
git commit -m "feat: implement secure token storage"
```

### Task 3: OAuth 2.0 Headless Client

**Files:**
- Create: `src/auth/OAuthClient.ts`
- Modify: `src/index.ts` (export)
- Test: `tests/auth/OAuthClient.test.ts`

**Step 1: Write failing test**
```typescript
import { OAuthClient } from '../../src/auth/OAuthClient';

describe('OAuthClient', () => {
  it('should generate correct auth URL', () => {
    const client = new OAuthClient();
    const url = client.getAuthUrl();
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('cloudaicompanion');
    expect(url).toContain('1071006060591');
  });
});
```

**Step 2: Run test**
Run: `npm test`
Expected: FAIL

**Step 3: Implementation**
- Implement `OAuthClient`.
- `getAuthUrl()`: Construct URL with required scopes and client ID.
- `startLocalServer()`: Spin up `http` server on random port to capture code.
- `exchangeCode(code)`: POST to google token endpoint.

**Step 4: Run test**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```bash
git add src/auth/OAuthClient.ts tests/auth/OAuthClient.test.ts
git commit -m "feat: implement oauth client"
```

### Task 4: LSP Process Discovery (Passive Strategy)

**Files:**
- Create: `src/quota/LSPFinder.ts`
- Test: `tests/quota/LSPFinder.test.ts`

**Step 1: Write failing test**
```typescript
import { LSPFinder } from '../../src/quota/LSPFinder';
import { exec } from 'child_process';

jest.mock('child_process');

describe('LSPFinder', () => {
  it('should find antigravity process', async () => {
    (exec as unknown as jest.Mock).mockImplementation((cmd, cb) => {
        cb(null, '1234 language_server_antigravity --csrf_token=xyz --extension_server_port=9999');
    });
    const finder = new LSPFinder();
    const info = await finder.findProcess();
    expect(info).toEqual({ pid: 1234, csrfToken: 'xyz', port: 9999 });
  });
});
```

**Step 2: Run test**
Run: `npm test`
Expected: FAIL

**Step 3: Implementation**
- Implement `LSPFinder`.
- `findProcess()`: Execute `ps` or similar to find `language_server.*antigravity`.
- Regex parse output for `--csrf_token` and `--extension_server_port`.
- If port missing, implement `lsof` logic (Task 4b, keep simple for now).

**Step 4: Run test**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```bash
git add src/quota/LSPFinder.ts tests/quota/LSPFinder.test.ts
git commit -m "feat: implement lsp process discovery"
```

### Task 5: Quota Polling & Telemetry

**Files:**
- Create: `src/quota/QuotaPoller.ts`
- Test: `tests/quota/QuotaPoller.test.ts`

**Step 1: Write failing test**
```typescript
import { QuotaPoller } from '../../src/quota/QuotaPoller';
import axios from 'axios';

jest.mock('axios');

describe('QuotaPoller', () => {
  it('should parse quota from response', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
        data: { clientModelConfigs: { quotaInfo: { remainingFraction: 0.8 } } }
    });
    const poller = new QuotaPoller();
    const quota = await poller.checkQuota(1234, 'token');
    expect(quota).toBe(0.8);
  });
});
```

**Step 2: Run test**
Run: `npm test`
Expected: FAIL

**Step 3: Implementation**
- Implement `QuotaPoller`.
- `checkQuota(port, csrfToken)`: POST to `127.0.0.1:<port>/.../GetUserStatus`.
- Parse JSON response.

**Step 4: Run test**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```bash
git add src/quota/QuotaPoller.ts tests/quota/QuotaPoller.test.ts
git commit -m "feat: implement quota polling"
```

### Task 6: Account Rotation Logic

**Files:**
- Create: `src/auth/AccountRotator.ts`
- Test: `tests/auth/AccountRotator.test.ts`

**Step 1: Write failing test**
```typescript
import { AccountRotator } from '../../src/auth/AccountRotator';

describe('AccountRotator', () => {
  it('should rotate account on failure', () => {
    const rotator = new AccountRotator(['acc1', 'acc2']);
    expect(rotator.getCurrentAccount()).toBe('acc1');
    rotator.markCurrentExhausted();
    expect(rotator.getCurrentAccount()).toBe('acc2');
  });
});
```

**Step 2: Run test**
Run: `npm test`
Expected: FAIL

**Step 3: Implementation**
- Implement `AccountRotator`.
- Maintain list of accounts.
- Track cooldown/exhaustion state.
- `getCurrentAccount()`: return first available.
- `markCurrentExhausted()`: flag current and rotate.

**Step 4: Run test**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```bash
git add src/auth/AccountRotator.ts tests/auth/AccountRotator.test.ts
git commit -m "feat: implement account rotation"
```

### Task 7: Integration

**Files:**
- Modify: `src/index.ts`
- Test: `tests/integration.test.ts`

**Step 1: Write failing test**
- Integration test simulating full flow (mocked system calls).

**Step 2: Run test**
- Fail.

**Step 3: Implementation**
- Wire up `TokenStore`, `AccountRotator`, `LSPFinder`, `QuotaPoller` in `activate`.
- Expose main API for OpenCode.

**Step 4: Run test**
- Pass.

**Step 5: Commit**
```bash
git add src/index.ts tests/integration.test.ts
git commit -m "feat: integrate all modules"
```
