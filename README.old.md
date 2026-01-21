# OpenCode Antigravity Autopilot

[![npm version](https://img.shields.io/npm/v/opencode-antigravity-autopilot.svg)](https://www.npmjs.com/package/opencode-antigravity-autopilot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Intelligent quota management and model rotation for [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth). Automatically switches models when quota runs low, tracks usage across accounts, and works with both **OpenCode** and **oh-my-opencode**.

## Quick Install

**New to the Antigravity ecosystem? Start here:**

👉 **[Complete Installation Guide](INSTALL.md)** - Step-by-step setup for auth + quota + oh-my-opencode

**Let an LLM set it up:**

```
Set up opencode-antigravity-autopilot for me. Follow:
https://raw.githubusercontent.com/gooseware/opencode-antigravity-autopilot/main/INSTALL.md

Ask me:
1. Am I using oh-my-opencode or vanilla OpenCode?
2. What models do I prefer? (e.g., gemini-3-pro, claude-sonnet-4-5-thinking)
3. Should quota rotation be automatic?

Then configure everything for me.
```

## Manual Install

### Prerequisites

- [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) installed and authenticated
- Node.js >= 20

### Installation

```bash
npm install opencode-antigravity-autopilot
```

## Configuration

### For OpenCode

Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "opencode-antigravity-auth@beta",
    "opencode-antigravity-autopilot"
  ]
}
```

### For oh-my-opencode

Add to `~/.config/opencode/oh-my-opencode.json`:

```json
{
  "google_auth": false,
  "quota_rotation": true,
  "agents": {
    "Sisyphus": { "model": "google/antigravity-claude-sonnet-4-5" },
    "librarian": { "model": "google/antigravity-gemini-3-flash" },
    "explore": { "model": "google/antigravity-gemini-3-flash" },
    "oracle": { "model": "google/antigravity-claude-opus-4-5-thinking" }
  }
}
```

## Usage

### Basic Usage

```typescript
import { QuotaManager } from 'opencode-antigravity-autopilot';

const manager = new QuotaManager({
  quotaThreshold: 0.2,
  preferredModels: [
    'google/antigravity-gemini-3-pro',
    'google/antigravity-claude-sonnet-4-5'
  ]
});

await manager.initialize();

const bestModel = manager.selectBestModel();
console.log(`Using model: ${bestModel}`);

const quota = await manager.getQuota();
console.log(`Remaining quota: ${quota?.remainingFraction * 100}%`);
```

### oh-my-opencode Integration

```typescript
import { createOhMyOpenCodeIntegration, QuotaManager } from 'opencode-antigravity-autopilot';

const manager = new QuotaManager();
await manager.initialize();

const integration = createOhMyOpenCodeIntegration(manager, {
  defaultModel: 'google/antigravity-gemini-3-flash'
});

const modelForAgent = await integration.getModelForAgent('oracle');
console.log(`Oracle will use: ${modelForAgent}`);
```

### Model Rotation Strategy

```typescript
manager.setModelRotationStrategy({
  preferredModels: [
    'google/antigravity-gemini-3-pro-high',
    'google/antigravity-claude-sonnet-4-5-thinking'
  ],
  fallbackModels: [
    'google/antigravity-gemini-3-flash',
    'google/gemini-2.5-flash'
  ],
  quotaThreshold: 0.15
});
```

## Features

- **Automatic Model Rotation**: Switches to fallback models when quota drops below threshold
- **Multi-Account Support**: Leverages opencode-antigravity-auth's account pool
- **Quota Tracking**: Real-time monitoring via LSP process
- **oh-my-opencode Compatible**: Dynamic agent model assignment
- **Zero Config**: Works out-of-box with sensible defaults

## How It Works

1. Reads authenticated accounts from opencode-antigravity-auth storage
2. Monitors quota via Antigravity LSP process (passive monitoring)
3. Tracks quota per model and selects best available option
4. Auto-rotates accounts when current account is exhausted
5. Integrates with oh-my-opencode for agent-level model management

## API

### `QuotaManager`

```typescript
const manager = new QuotaManager(config?: PluginConfig);
await manager.initialize();

manager.getQuota(): Promise<QuotaInfo | null>
manager.selectBestModel(): string | null
manager.rotateAccount(): Promise<void>
manager.updateQuotaForModel(model: string, quota: QuotaInfo): void
manager.setModelRotationStrategy(strategy: ModelRotationStrategy): void
```

### `createOhMyOpenCodeIntegration`

```typescript
const integration = createOhMyOpenCodeIntegration(manager, config);

integration.getModelForAgent(agentName: string, preferredModel?: string): Promise<string>
integration.updateAgentConfig(config: OhMyOpenCodeConfig, strategy: ModelRotationStrategy): OhMyOpenCodeConfig
integration.pollQuotaAndRotate(models: string[]): Promise<void>
```

## Configuration Options

```typescript
interface PluginConfig {
  quotaThreshold?: number;        // Default: 0.2 (20%)
  pollIntervalMs?: number;         // Default: 60000 (1 min)
  enableRotation?: boolean;        // Default: true
  preferredModels?: string[];      // Models to prefer
}
```

## Troubleshooting

**LSP Process Not Found**
- Ensure Antigravity IDE is running
- Check `ps aux | grep language_server_antigravity`

**Quota Always Shows Null**
- Verify opencode-antigravity-auth is authenticated
- Restart Antigravity IDE

**Models Not Rotating**
- Check `quotaThreshold` setting
- Verify preferred models are configured correctly

## Credits

Built on [opencode-antigravity-auth](https://github.com/NoeFabris/opencode-antigravity-auth) by [@NoeFabris](https://github.com/NoeFabris). This plugin extends its authentication system with intelligent quota management.

## License

MIT

## Contributing

Issues and PRs welcome at [github.com/gooseware/opencode-antigravity-autopilot](https://github.com/gooseware/opencode-antigravity-autopilot)
