# Antigravity Quota Plugin Implementation Plan (Updated)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement `opencode-antigravity-autopilot` plugin to provide real-time quota telemetry and manage account rotation using existing authenticated sessions from `opencode-antigravity-auth`.

**Architecture:** A Node.js based plugin. It reads tokens from the existing `opencode-antigravity-auth` storage (V3 schema), implements "Passive" quota acquisition via LSP sniffing, "Active" via header inspection, and an Account Rotation "Load Balancer" to switch accounts upon exhaustion.

**Tech Stack:** TypeScript, Node.js (fs, child_process, http), Jest (testing), Axios (HTTP requests).

### Task 1: Project Skeleton & Configuration (Completed)

*Already completed in previous session.*

### Task 2: Token Storage Reader (V3 Schema)

**Files:**
- Create: `src/auth/TokenStorageReader.ts`
- Test: `tests/auth/TokenStorageReader.test.ts`

**Step 1: Write failing test**
```typescript
import { TokenStorageReader } from '../../src/auth/TokenStorageReader';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

describe('TokenStorageReader', () => {
  const mockV3Data = {
    version: 3,
    accounts: [
      { refreshToken: 'rt1', email: 'test1@gmail.com' },
      { refreshToken: 'rt2', email: 'test2@gmail.com' }
    ],
    activeIndex: 0
  };

  it('should load and parse V3 accounts', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockV3Data));
    
    const reader = new TokenStorageReader();
    const accounts = reader.getAccounts();
    
    expect(accounts).toHaveLength(2);
    expect(accounts[0].refreshToken).toBe('rt1');
    expect(reader.getActiveIndex()).toBe(0);
  });
});
```

**Step 2: Run test**
Run: `npm test`
Expected: FAIL

**Step 3: Implementation**
- Implement `TokenStorageReader`.
- Define interfaces for `AccountStorageV3` and `AccountMetadataV3`.
- `getStoragePath()`: Resolve `~/.config/opencode/antigravity-accounts.json` (handle XDG/Platform logic).
- `load()`: Read file, validate `version: 3`, parse `accounts` and `activeIndex`.

**Step 4: Run test**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```bash
git add src/auth/TokenStorageReader.ts tests/auth/TokenStorageReader.test.ts
git commit -m "feat: implement token storage reader for V3 schema"
```

### Task 3: LSP Process Discovery (Passive Strategy)

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
        // Simulate ps output
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
- `findProcess()`: Execute `ps aux` (Linux/Mac) or `wmic` (Windows - optionally, stick to Unix for now as per env).
- Regex search for `language_server.*antigravity`.
- Extract `--csrf_token` and `--extension_server_port`.

**Step 4: Run test**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```bash
git add src/quota/LSPFinder.ts tests/quota/LSPFinder.test.ts
git commit -m "feat: implement lsp process discovery"
```

### Task 4: Quota Polling & Telemetry

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
    const quota = await poller.checkQuota(1234, 'token'); // port, csrfToken
    expect(quota.remainingFraction).toBe(0.8);
  });
});
```

**Step 2: Run test**
Run: `npm test`
Expected: FAIL

**Step 3: Implementation**
- Implement `QuotaPoller`.
- `checkQuota(port, csrfToken)`:
  - POST to `http://127.0.0.1:<port>/exa.language_server_pb.LanguageServerService/GetUserStatus`.
  - Headers: `X-Codeium-Csrf-Token: <csrfToken>`.
  - Body: `{"ideName": "antigravity", "ideVersion": "unknown"}`.
  - Return `remainingFraction` and `resetTime`.

**Step 4: Run test**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```bash
git add src/quota/QuotaPoller.ts tests/quota/QuotaPoller.test.ts
git commit -m "feat: implement quota polling"
```

### Task 5: Account Rotation Logic

**Files:**
- Create: `src/auth/AccountRotator.ts`
- Test: `tests/auth/AccountRotator.test.ts`

**Step 1: Write failing test**
```typescript
import { AccountRotator } from '../../src/auth/AccountRotator';
import { AccountMetadataV3 } from '../../src/auth/TokenStorageReader';

describe('AccountRotator', () => {
  const accounts: AccountMetadataV3[] = [
    { refreshToken: 't1', addedAt: 0, lastUsed: 0 },
    { refreshToken: 't2', addedAt: 0, lastUsed: 0 }
  ];

  it('should rotate to next account when marked exhausted', () => {
    const rotator = new AccountRotator(accounts, 0); // Start at index 0
    expect(rotator.getCurrentAccount().refreshToken).toBe('t1');
    
    rotator.markCurrentExhausted();
    expect(rotator.getCurrentAccount().refreshToken).toBe('t2');
  });

  it('should skip cooled down accounts', () => {
     const accountsWithCoolDown: AccountMetadataV3[] = [
        { refreshToken: 't1', addedAt: 0, lastUsed: 0, coolingDownUntil: Date.now() + 10000 },
        { refreshToken: 't2', addedAt: 0, lastUsed: 0 }
     ];
     const rotator = new AccountRotator(accountsWithCoolDown, 0);
     // Should skip t1 because it has coolingDownUntil > now
     expect(rotator.getCurrentAccount().refreshToken).toBe('t2');
  });
});
```

**Step 2: Run test**
Run: `npm test`
Expected: FAIL

**Step 3: Implementation**
- Implement `AccountRotator`.
- Constructor takes `AccountMetadataV3[]` and `initialIndex`.
- `getCurrentAccount()`: Iterates starting from `activeIndex`. Checks `coolingDownUntil`. Returns first valid.
- `markCurrentExhausted(cooldownMs)`: Sets `coolingDownUntil` on current account, increments `activeIndex` (mod length).

**Step 4: Run test**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```bash
git add src/auth/AccountRotator.ts tests/auth/AccountRotator.test.ts
git commit -m "feat: implement account rotation with cooldown support"
```

### Task 6: Integration (Main Entrypoint)

**Files:**
- Modify: `src/index.ts`
- Test: `tests/integration.test.ts`

**Step 1: Write failing test**
- Integration test simulating the `activate` flow.
- Mock `TokenStorageReader` to return fake accounts.
- Mock `LSPFinder` to return fake process info.
- Verify `activate` returns an API/Object that allows retrieving the current valid token/quota.

**Step 2: Run test**
Run: `npm test`
Expected: FAIL

**Step 3: Implementation**
- `activate()`:
  - Instantiate `TokenStorageReader` -> load accounts.
  - Instantiate `AccountRotator`.
  - Instantiate `LSPFinder` -> find local process.
  - Instantiate `QuotaPoller`.
  - Expose `getQuota()` and `getToken()` methods.

**Step 4: Run test**
Run: `npm test`
Expected: PASS

**Step 5: Commit**
```bash
git add src/index.ts tests/integration.test.ts
git commit -m "feat: integrate all modules"
```
