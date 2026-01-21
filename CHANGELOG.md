# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-22

### 🎉 Major Release - Plugin-Only Implementation

### Added
- **Plugin Tools for LLM**
  - `quota_status` - Check current quota status
  - `quota_check_model` - Check specific model quota
  - `quota_rotate_account` - Manual account rotation
- **API-Based Quota Checking**
  - `ApiQuotaPoller` - Real-time quota from Google Cloud Code API
  - Authoritative quota data instead of LSP polling
- **Hard Limit Detection**
  - `HardLimitDetector` - Automatic model switching on quota exhaustion
  - Proactive switching when quota drops below threshold
  - Account rotation when all models exhausted
- **Quota Cache Service**
  - `QuotaCacheUpdater` - Background quota tracking
  - Cache file for UI integrations
- **Testing & Scripts**
  - `test-hard-limit.js` - Test hard limit detection
  - `start-quota-service.js` - Background quota service

### Changed
- **Plugin-Only Architecture**
  - No OpenCode source modifications required
  - Pure plugin implementation using OpenCode's tool system
  - LLM-aware quota management
- **Module Resolution**
  - Updated to `bundler` for better TypeScript support
- **Package Metadata**
  - Updated description and keywords
  - Added new scripts: `test:quota`, `service:start`

### Removed
- ❌ OpenCode source modifications (header.tsx, quota-display.tsx)
- ❌ Visual UI components
- ❌ Source code dependencies

### Fixed
- Hard limit detection now works reliably with API data
- Model switching triggers correctly on quota exhaustion
- Account rotation properly marks exhausted accounts

## [1.0.6] - 2026-01-14

### Added
- Initial release
- Basic quota management
- LSP-based quota polling
- Model rotation logic
- oh-my-opencode integration

[2.0.0]: https://github.com/gooseware/opencode-antigravity-autopilot/compare/v1.0.6...v2.0.0
[1.0.6]: https://github.com/gooseware/opencode-antigravity-autopilot/releases/tag/v1.0.6
