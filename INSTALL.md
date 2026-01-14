# Installation Guide

Complete setup guide for the Antigravity ecosystem: authentication + quota management.

## Prerequisites

- [OpenCode](https://opencode.ai) installed
- Google account
- Node.js >= 20

## Option A: Quick Install (LLM-Assisted)

**Paste this into any LLM agent:**

```
Set up the complete Antigravity ecosystem for me by following:
https://raw.githubusercontent.com/gooseware/antigravity-autopilot/main/INSTALL.md

Ask me:
1. Do I want oh-my-opencode for specialized agents?
2. What models should I prioritize?
3. Should I use multiple Google accounts for higher quota?

Then configure everything step-by-step.
```

## Option B: Manual Installation

### Step 1: Install Authentication Plugin

```bash
# OpenCode will auto-install the plugin
npm install -g opencode-antigravity-auth@beta
```

**Configure OpenCode** (`~/.config/opencode/opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-antigravity-auth@beta"],
  "provider": {
    "google": {
      "models": {
        "antigravity-gemini-3-pro": {
          "name": "Gemini 3 Pro (Antigravity)",
          "limit": { "context": 1048576, "output": 65535 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] },
          "variants": {
            "low": { "thinkingLevel": "low" },
            "high": { "thinkingLevel": "high" }
          }
        },
        "antigravity-gemini-3-flash": {
          "name": "Gemini 3 Flash (Antigravity)",
          "limit": { "context": 1048576, "output": 65536 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] }
        },
        "antigravity-claude-sonnet-4-5-thinking": {
          "name": "Claude Sonnet 4.5 Thinking (Antigravity)",
          "limit": { "context": 200000, "output": 64000 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] },
          "variants": {
            "low": { "thinkingConfig": { "thinkingBudget": 8192 } },
            "max": { "thinkingConfig": { "thinkingBudget": 32768 } }
          }
        }
      }
    }
  }
}
```

**Authenticate:**

```bash
opencode auth login
```

### Step 2: Install oh-my-opencode (Optional)

**What is oh-my-opencode?**

An agent orchestration system that provides specialized agents (explore, librarian, oracle, etc.) for complex tasks.

**Installation:**

```bash
npm install -g oh-my-opencode
```

**Configure** (`~/.config/opencode/oh-my-opencode.json`):

```json
{
  "$schema": "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/master/assets/oh-my-opencode.schema.json",
  "google_auth": false,
  "agents": {
    "Sisyphus": {
      "model": "google/antigravity-gemini-3-pro"
    },
    "librarian": {
      "model": "google/antigravity-gemini-3-flash"
    },
    "explore": {
      "model": "google/antigravity-gemini-3-flash"
    },
    "oracle": {
      "model": "google/antigravity-claude-sonnet-4-5-thinking"
    },
    "frontend-ui-ux-engineer": {
      "model": "google/antigravity-gemini-3-flash"
    },
    "document-writer": {
      "model": "google/antigravity-gemini-3-flash"
    },
    "multimodal-looker": {
      "model": "google/antigravity-gemini-3-flash"
    }
  }
}
```

**Enable in OpenCode** (`~/.config/opencode/opencode.json`):

```json
{
  "plugin": [
    "oh-my-opencode",
    "opencode-antigravity-auth@beta"
  ]
}
```

### Step 3: Install Quota Plugin

```bash
npm install -g antigravity-autopilot
```

**Update OpenCode config** (`~/.config/opencode/opencode.json`):

```json
{
  "plugin": [
    "oh-my-opencode",
    "opencode-antigravity-auth@beta",
    "antigravity-autopilot"
  ]
}
```

**Done!** The quota plugin will automatically:
- Monitor quota via Antigravity LSP
- Rotate models when quota is low
- Rotate accounts when current account is exhausted

## Verification

### Test Authentication

```bash
opencode run "Hello from Antigravity" --model=google/antigravity-gemini-3-flash
```

### Test Quota Plugin

```bash
node -e "
const { QuotaManager } = require('antigravity-autopilot');
const manager = new QuotaManager();
manager.initialize().then(async () => {
  const quota = await manager.getQuota();
  console.log('Quota:', quota);
  const model = manager.selectBestModel();
  console.log('Best model:', model);
});
"
```

### Test oh-my-opencode (if installed)

```bash
opencode run "Search the codebase for authentication patterns" --agent=explore
```

## Multi-Account Setup

Add multiple Google accounts for higher combined quota:

```bash
opencode auth login
# Select "(a)dd new account"
# Authenticate with additional Google account
```

The auth plugin will automatically rotate between accounts when one hits rate limits.

## Configuration Tips

### For Maximum Quota

1. Add 3-5 Google accounts via `opencode auth login`
2. Enable quota fallback in `~/.config/opencode/antigravity.json`:

```json
{
  "quota_fallback": true,
  "switch_on_first_rate_limit": true
}
```

### For oh-my-opencode Users

Create `~/.config/opencode/quota.json`:

```json
{
  "quotaThreshold": 0.15,
  "preferredModels": [
    "google/antigravity-gemini-3-pro",
    "google/antigravity-claude-sonnet-4-5-thinking"
  ],
  "enableRotation": true
}
```

## Troubleshooting

**"No accounts configured"**
- Run: `opencode auth login`

**"LSP process not found"**
- Ensure Antigravity IDE is running
- Check: `ps aux | grep language_server_antigravity`

**"Plugin not found"**
- Install: `npm install -g opencode-antigravity-auth@beta antigravity-autopilot`
- Verify: `npm list -g | grep antigravity`

**oh-my-opencode agents not working**
- Ensure plugin order: oh-my-opencode BEFORE auth plugins
- Check: `~/.config/opencode/oh-my-opencode.json` exists

## Complete Example Config

**`~/.config/opencode/opencode.json`** (with oh-my-opencode):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "oh-my-opencode",
    "opencode-antigravity-auth@beta",
    "antigravity-autopilot"
  ],
  "provider": {
    "google": {
      "models": {
        "antigravity-gemini-3-pro": {
          "name": "Gemini 3 Pro (Antigravity)",
          "limit": { "context": 1048576, "output": 65535 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] },
          "variants": {
            "low": { "thinkingLevel": "low" },
            "high": { "thinkingLevel": "high" }
          }
        },
        "antigravity-gemini-3-flash": {
          "name": "Gemini 3 Flash (Antigravity)",
          "limit": { "context": 1048576, "output": 65536 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] }
        },
        "antigravity-claude-sonnet-4-5": {
          "name": "Claude Sonnet 4.5 (Antigravity)",
          "limit": { "context": 200000, "output": 64000 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] }
        },
        "antigravity-claude-sonnet-4-5-thinking": {
          "name": "Claude Sonnet 4.5 Thinking (Antigravity)",
          "limit": { "context": 200000, "output": 64000 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] },
          "variants": {
            "low": { "thinkingConfig": { "thinkingBudget": 8192 } },
            "max": { "thinkingConfig": { "thinkingBudget": 32768 } }
          }
        },
        "antigravity-claude-opus-4-5-thinking": {
          "name": "Claude Opus 4.5 Thinking (Antigravity)",
          "limit": { "context": 200000, "output": 64000 },
          "modalities": { "input": ["text", "image", "pdf"], "output": ["text"] },
          "variants": {
            "low": { "thinkingConfig": { "thinkingBudget": 8192 } },
            "max": { "thinkingConfig": { "thinkingBudget": 32768 } }
          }
        }
      }
    }
  }
}
```

**`~/.config/opencode/oh-my-opencode.json`**:

```json
{
  "$schema": "https://raw.githubusercontent.com/code-yeongyu/oh-my-opencode/master/assets/oh-my-opencode.schema.json",
  "google_auth": false,
  "agents": {
    "Sisyphus": { "model": "google/antigravity-gemini-3-pro" },
    "librarian": { "model": "google/antigravity-gemini-3-flash" },
    "explore": { "model": "google/antigravity-gemini-3-flash" },
    "oracle": { "model": "google/antigravity-claude-opus-4-5-thinking" },
    "frontend-ui-ux-engineer": { "model": "google/antigravity-gemini-3-flash" },
    "document-writer": { "model": "google/antigravity-gemini-3-flash" },
    "multimodal-looker": { "model": "google/antigravity-gemini-3-flash" }
  }
}
```

## Links

- [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) - Authentication plugin
- [oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) - Agent orchestration
- [OpenCode](https://opencode.ai) - Base platform

## Support

- Auth issues: https://github.com/NoeFabris/opencode-antigravity-auth/issues
- Quota issues: https://github.com/gooseware/antigravity-autopilot/issues
- oh-my-opencode: https://github.com/code-yeongyu/oh-my-opencode/issues
