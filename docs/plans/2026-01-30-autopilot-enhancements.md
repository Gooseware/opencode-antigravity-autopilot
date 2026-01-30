# Autopilot Model Rotation and Quota Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance model rotation to use highest availability, improve quota cache readability with refresh timestamps, refine model translation, and implement auto-return to preferred models.

**Architecture:** 
- `QuotaTracker` will be updated to select candidates based on the highest remaining quota fraction.
- `QuotaCacheUpdater` will expand the cache schema to include `refreshDate`, `quotaUsed`, and human-readable summaries.
- `ModelSelector` and `QuotaManager` will be updated to track "manual" vs "automatic" selection states to allow auto-recovery to preferred models.
- `ModelNameTranslator` will be synchronized with `opencode-antigravity-quota` patterns.

**Tech Stack:** TypeScript, Node.js, Jest for testing.

---

### Task 1: Update QuotaTracker for Highest Availability Selection

**Files:**
- Modify: `src/rotation/QuotaTracker.ts`
- Test: `tests/rotation/QuotaTracker.test.ts` (Create if missing)

**Step 1: Write the failing test**

```typescript
// tests/rotation/QuotaTracker.test.ts
import { QuotaTracker } from '../../src/rotation/QuotaTracker';

describe('QuotaTracker', () => {
  it('should select the model with the highest quota fraction among candidates', () => {
    const tracker = new QuotaTracker(0.05);
    tracker.updateQuota('model-a', { remainingFraction: 0.1 });
    tracker.updateQuota('model-b', { remainingFraction: 0.8 });
    tracker.updateQuota('model-c', { remainingFraction: 0.5 });
    
    const best = tracker.getBestAvailableModel(['model-a', 'model-b', 'model-c']);
    expect(best).toBe('model-b');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test tests/rotation/QuotaTracker.test.ts`
Expected: FAIL (currently picks first available model in list order)

**Step 3: Write minimal implementation**

Modify `getBestAvailableModel` in `src/rotation/QuotaTracker.ts` to find the model with max `quotaFraction`.

**Step 4: Run test to verify it passes**

Run: `npm test tests/rotation/QuotaTracker.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/rotation/QuotaTracker.ts tests/rotation/QuotaTracker.test.ts
git commit -m "feat(rotation): implement highest availability model selection"
```

---

### Task 2: Enhance Quota Cache with Detailed Information

**Files:**
- Modify: `src/quota/QuotaCacheUpdater.ts`
- Modify: `src/types.ts`
- Test: `tests/quota/QuotaCacheUpdater.test.ts`

**Step 1: Write the failing test**

**Step 2: Run test to verify it fails**

**Step 3: Write minimal implementation**

- Update `QuotaCache` interface in `src/quota/QuotaCacheUpdater.ts`.
- Update `writeQuotaToCache` and `updateCache` to populate new fields.
- `refreshDate` should be the `resetTime` from `QuotaInfo` or a calculated timestamp.
- `humanReadable` should contain a string like "80% used, resets at ..."

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add src/quota/QuotaCacheUpdater.ts src/types.ts
git commit -m "feat(quota): enhance cache with human-readable info and refresh dates"
```

---

### Task 3: Refine Model Name Translation

**Files:**
- Modify: `src/utils/model-name-translator.ts`
- Test: `tests/utils/model-name-translator.test.ts`

**Step 1: Write tests for missing patterns**

Ensure `Gemini 2.5`, `Claude 3.5`, and others from `opencode-antigravity-quota` are handled correctly.

**Step 2: Run test to verify it fails**

**Step 3: Synchronize patterns and aliases**

**Step 4: Run test to verify it passes**

**Step 5: Commit**

```bash
git add src/utils/model-name-translator.ts
git commit -m "style(utils): refine model name translation patterns"
```

---

### Task 4: Implement Auto-Return to Preferred Model

**Files:**
- Modify: `src/manager.ts`
- Modify: `src/oh-my-opencode.ts`
- Modify: `src/types.ts`

**Logic:**
- Store `isManualSelection` flag in `QuotaManager`.
- In `getModelForAgent`, if not manual and preferred model's quota is now healthy (above threshold), switch back.
- If `preferredModel` is explicitly passed to `getModelForAgent` from a user-facing tool, set `isManualSelection = true`.

**Step 1: Add state tracking to QuotaManager**

**Step 2: Implement "return to preferred" logic in `oh-my-opencode.ts`**

**Step 3: Verify via integration tests**

**Step 4: Commit**

```bash
git add src/manager.ts src/oh-my-opencode.ts src/types.ts
git commit -m "feat(rotation): implement auto-return to preferred model when quota refreshes"
```

---

### Task 5: Final Audit, Release and Cache Update

**Steps:**
1. Run all tests: `npm test`
2. Audit build: `npm run build`
3. Commit all remaining changes to `dev`.
4. Update local cache:
```bash
# This mimics the user's requested release step
rm -rf ~/.cache/opencode/node_modules/opencode-antigravity-autopilot/dist
cp -r dist ~/.cache/opencode/node_modules/opencode-antigravity-autopilot/
cp package.json ~/.cache/opencode/node_modules/opencode-antigravity-autopilot/
```
