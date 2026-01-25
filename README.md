# OpenCode Antigravity Autopilot

[![npm version](https://img.shields.io/npm/v/opencode-antigravity-autopilot.svg)](https://www.npmjs.com/package/opencode-antigravity-autopilot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Intelligent quota monitoring and automatic model switching for OpenCode with Antigravity.**

Zero OpenCode source modifications required - works as a pure plugin!

## ✨ Features

- 🔍 **Real-time Quota Monitoring** - Check quota via LLM tools
- 🔄 **Automatic Model Switching** - Switch models when quota exhausted
- 🎯 **Proactive Optimization** - Switch before hitting hard limits
- 🔁 **Account Rotation** - Automatically rotate between accounts
- 🛠️ **Plugin-Based** - No OpenCode source modifications needed
- 🤖 **LLM-Aware** - Assistant can check quota and make decisions

## 🚀 Quick Start

### 🤖 Install with LLM

Simply copy and paste this prompt to your OpenCode assistant:

> Please read the documentation at https://github.com/Gooseware/opencode-antigravity-autopilot#readme to understand the installation steps.
> Install the `opencode-antigravity-autopilot` plugin from npm.
> Then, configure `~/.config/opencode/opencode.json` to add `"opencode-antigravity-autopilot"` to the `plugin` list.
> Finally, create a default quota config in `~/.config/opencode/quota.json` with auto-rotation enabled for models like `antigravity-gemini-3-pro-high` and `antigravity-claude-sonnet-4-5`.

### From NPM

```bash
npm install opencode-antigravity-autopilot
```

### From GitHub (Source)

```bash
git clone https://github.com/Gooseware/opencode-antigravity-autopilot.git
cd opencode-antigravity-autopilot
npm install
npm run build
npm link
```

### Prerequisites

- Node.js >= 20.0.0
- [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) installed and configured
- OpenCode with plugin support

### Configuration

#### Plugin Registration

Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "opencode-antigravity-auth",
    "opencode-antigravity-autopilot"
  ]
}
```

#### Quota Configuration

Create `~/.config/opencode/quota.json` to configure thresholds and models:

```json
{
  "quotaThreshold": 0.05,
  "preferredModels": [
    "antigravity-gemini-3-pro-high",      // Try this first
    "antigravity-claude-sonnet-4-5",      // Then this
    "antigravity-gemini-3-flash"          // Fallback
  ],
  "autoRotate": true
}
```

That's it! The plugin is now active.

## 📖 Usage

### Check Quota via LLM

Simply ask your assistant:

```
"Check my quota status"
"Show detailed quota for all models"
"Can I use antigravity-gemini-3-pro-high right now?"
```

The LLM will call the appropriate tools and show results like:

```
# Quota Status

✓ **Current Model:** antigravity-gemini-3-pro-high
**Status:** Quota healthy at 67%

**Accounts:** 1 of 3 active
```

### Available Tools

The plugin exposes three tools to the LLM:

#### `quota_status`
Check current quota with optional detailed view

```typescript
quota_status()
quota_status({ detailed: true })
```

#### `quota_check_model`
Check if a specific model has enough quota

```typescript
quota_check_model({ model: "antigravity-gemini-3-pro-high" })
```

#### `quota_rotate_account`
Manually rotate to next available account

```typescript
quota_rotate_account()
```

### Programmatic Usage

```typescript
import { HardLimitDetector } from 'opencode-antigravity-autopilot';

const detector = new HardLimitDetector({
  quotaThreshold: 0.2,  // Switch when below 20%
  preferredModels: [
    'google/antigravity-gemini-3-pro-high',
    'google/antigravity-claude-sonnet-4-5'
  ]
});

// Before using a model
const result = await detector.checkHardLimit('antigravity-gemini-3-pro-high');

if (result.shouldRotate) {
  console.log(`Switching to: ${result.nextModel}`);
}
```

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│  OpenCode (No modifications)    │
│                                 │
│  LLM Tools:                     │
│  - quota_status                 │
│  - quota_check_model            │
│  - quota_rotate_account         │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│   Autopilot Plugin              │
│                                 │
│  ┌──────────────────────┐       │
│  │  ApiQuotaPoller      │       │
│  │  Real-time API data  │       │
│  └──────────────────────┘       │
│                                 │
│  ┌──────────────────────┐       │
│  │  HardLimitDetector   │       │
│  │  Auto model switch   │       │
│  └──────────────────────┘       │
└─────────────────────────────────┘
```

## 🔧 Configuration

### Quota Threshold

Configure when to proactively switch models:

```typescript
import { QuotaManager } from 'opencode-antigravity-autopilot';

const manager = new QuotaManager({
  quotaThreshold: 0.2  // Switch when below 20%
});
```

### Preferred Models

Set model preference order:

```typescript
import { HardLimitDetector } from 'opencode-antigravity-autopilot';

const detector = new HardLimitDetector({
  preferredModels: [
    'google/antigravity-gemini-3-pro-high', // Try first
    'google/antigravity-claude-sonnet-4-5', // Try second  
    'google/antigravity-gemini-3-flash'     // Fallback
  ]
});
```

## 🧪 Testing

```bash
# Test hard limit detection
npm run test:quota

# Run full test suite
npm test
```

## 📊 API Reference

### HardLimitDetector

```typescript
class HardLimitDetector {
  constructor(config?: PluginConfig);
  
  checkHardLimit(currentModel: string): Promise<HardLimitCheckResult>;
  updateAllQuotas(): Promise<void>;
  rotateAccount(): Promise<void>;
}

interface HardLimitCheckResult {
  isExhausted: boolean;
  shouldRotate: boolean;
  nextModel?: string;
  message?: string;
}
```

### QuotaManager

```typescript
class QuotaManager {
  constructor(config?: PluginConfig);
  
  initialize(): Promise<void>;
  getQuotaViaApi(modelName?: string): Promise<QuotaInfo | null>;
  getAllQuotasViaApi(): Promise<Map<string, QuotaInfo>>;
  rotateAccount(): Promise<void>;
}
```

### QuotaCacheUpdater

```typescript
class QuotaCacheUpdater {
  constructor(manager: QuotaManager, updateIntervalMs?: number);
  
  updateCache(): Promise<void>;
  start(): void;
  stop(): void;
}

function startQuotaCacheService(updateIntervalMs?: number): Promise<QuotaCacheUpdater>;
```

## 🛠️ Advanced Usage

### Background Quota Service

Run a background service to keep quota cache updated:

```bash
npm run service:start
```

Or programmatically:

```typescript
import { startQuotaCacheService } from 'opencode-antigravity-autopilot';

const updater = await startQuotaCacheService(60000); // Update every 60s
updater.start();

// Later...
updater.stop();
```

### oh-my-opencode Integration

```typescript
import { 
  createOhMyOpenCodeIntegration,
  QuotaManager 
} from 'opencode-antigravity-autopilot';

const manager = new QuotaManager();
await manager.initialize();

const integration = createOhMyOpenCodeIntegration(manager, {
  defaultModel: 'google/antigravity-gemini-3-flash'
});

const model = await integration.getModelForAgent('oracle');
console.log(`Oracle will use: ${model}`);
```

## 🐛 Troubleshooting

### Tools Not Showing Up

```bash
# Verify plugin is installed
npm list opencode-antigravity-autopilot

# Check OpenCode config
cat ~/.config/opencode/opencode.json
```

### Quota Check Fails

```bash
# Verify authentication
cat ~/.config/opencode/antigravity-accounts.json

# Test manually
node -e "const {QuotaManager} = require('opencode-antigravity-autopilot'); const m = new QuotaManager(); m.initialize().then(() => m.getQuotaViaApi().then());"
```

### Model Switch Not Working

```bash
# Test hard limit detector
npm run test:quota
```

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT © [gooseware](https://github.com/gooseware)

## 🙏 Credits

Built on top of:
- [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) by [@NoeFabris](https://github.com/NoeFabris)
- [OpenCode](https://github.com/opencode-ai/opencode)

## 📚 Related Projects

- [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) - Authentication for Antigravity
- [opencode-antigravity-quota](https://github.com/gooseware/opencode-antigravity-quota) - Standalone quota checker
- [oh-my-opencode](https://github.com/opencode-ai/oh-my-opencode) - Enhanced OpenCode experience

## 💬 Support

- [GitHub Issues](https://github.com/gooseware/opencode-antigravity-autopilot/issues)
- [Discussions](https://github.com/gooseware/opencode-antigravity-autopilot/discussions)

---

**Made with ❤️ for the OpenCode community**
