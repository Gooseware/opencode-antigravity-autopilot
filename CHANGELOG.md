# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-01-30

### Added
- **Highest Availability Selection** - Improved model rotation to select the candidate with the most remaining quota fraction instead of just the first available.
- **Enhanced Quota Cache** - Added `refreshDate`, `quotaUsed`, and human-readable summaries to the quota cache for better visibility in UIs.
- **Manual Selection Support** - Added `quota_use_model` and `quota_auto_mode` tools to allow users to lock a specific model while preserving the ability to auto-return to preferred models later.
- **Auto-Return Logic** - System now intelligently returns to the user's preferred model once its quota has refreshed, if not in manual override mode.

### Fixed
- **Model Name Translation** - Refined patterns for Gemini 2.5, Gemini 1.5, Claude 3.5, and more to ensure consistent display names.

## [2.2.8] - 2026-01-24

### Fixed
- **Model Selector Order** - Corrected `ModelSelector` to strictly respect the user's preference order defined in `quota.json`. Previously, it was incorrectly picking the model with the highest remaining quota percentage instead of following the priority list.
- **Provider ID Support** - Improved `providerID` detection for more models (including GPT/OpenAI) and added support for explicit `provider/model` format in model IDs.

## [2.2.7] - 2026-01-24

### Fixed
- Bumped version for release after manual README fixes

## [2.2.6] - 2026-01-24

### Fixed
- **README in npmjs** - Resolved issues with README formatting and visibility on npmjs.com

## [2.1.2] - 2026-01-23

### Fixed
- **API Access Error (400)** - Updated CloudCode metadata constants to match the values required by the Google Cloud Code API
  - Fixed regression where `loadCodeAssist` and `fetchAvailableModels` were failing with 400 Bad Request
  - Synced metadata values with `opencode-antigravity-quota` implementation
  - Ensures reliable quota fetching using existing credentials

## [2.1.1] - 2026-01-23

### Added
- **Comprehensive Logging System** - File-based logging to `/tmp` with daily rotation
  - Format: `[timestamp] [level] [component] message | data`
  - Outputs to both file and console for visibility
  - Keeps last 7 days of logs automatically
  - Detailed logging across all components (HardLimitDetector, QuotaManager, ModelSelector, QuotaTracker, PluginTools)
- **LOGGING.md Documentation** - Complete guide for monitoring and analyzing logs

### Changed
- **Threshold Configuration** - Default quota threshold changed from 0.2 (20%) to 0.02 (2%)
  - Model switching now occurs at 98% usage / 2% remaining quota
  - More aggressive switching to prevent quota exhaustion
  - Applied consistently across HardLimitDetector, QuotaManager, and QuotaTracker

### Improved
- **Decision Point Tracking** - All critical decision points now logged:
  - Quota checks with percentages
  - Threshold comparisons and evaluations
  - Model switch events with reasoning
  - Account rotations with details
  - API fetch attempts and results
  - Authentication failures and retries

## [2.1.0] - 2026-01-22

### Added
- **lastSelectedModel Tracking** - QuotaManager now remembers and reports on the active model
- **Improved Quota UX** - Overhauled `quota_status` tool with filtered model lists and clean formatting
- **Standardized Health Thresholds** - Green ≥ 50%, Yellow 20-49%, Red < 20%

### Fixed
- **Authentication 401 error** - Fixed token refresh logic with automatic account rotation
- **API 404 error** - Corrected CloudCode API endpoint URL
- **Polling Spam** - Enforced 5-minute minimum interval and fixed context issues in poller loop
- **Runtime Crashes** - Moved property initializers to prevent 'undefined this' errors


## [2.0.1] - 2026-01-22

### Fixed
- **Accurate quota reset time tracking** - Uses actual API reset times instead of hardcoded 30-minute cooldowns
  - `QuotaManager.rotateAccount()` accepts optional `resetTimeISO` parameter
  - `HardLimitDetector` passes API reset time to rotator
  - `quota_rotate_account` tool displays actual reset timestamp with countdown
  - Account cooldowns now match Google's actual quota reset schedule

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

[2.1.2]: https://github.com/gooseware/opencode-antigravity-autopilot/compare/v2.1.1...v2.1.2
[2.1.1]: https://github.com/gooseware/opencode-antigravity-autopilot/compare/v2.1.0...v2.1.1
[2.1.0]: https://github.com/gooseware/opencode-antigravity-autopilot/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/gooseware/opencode-antigravity-autopilot/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/gooseware/opencode-antigravity-autopilot/compare/v1.0.6...v2.0.0
[1.0.6]: https://github.com/gooseware/opencode-antigravity-autopilot/releases/tag/v1.0.6
