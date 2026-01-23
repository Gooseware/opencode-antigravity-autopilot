/**
 * Model Name Translation Utility
 * 
 * Translates between API model names and user-friendly display names for toaster notifications.
 * Reuses logic from opencode-antigravity-auth's model-resolver.ts
 */

/**
 * Model aliases - maps API internal names to user-friendly names.
 * Reverse mapping of MODEL_ALIASES from model-resolver.ts
 */
const API_TO_DISPLAY_NAMES: Record<string, string> = {
  // Gemini models
  'MODEL_GEMINI_3_PRO': 'Gemini 3 Pro',
  'MODEL_GEMINI_3_PRO_LOW': 'Gemini 3 Pro (Low)',
  'MODEL_GEMINI_3_PRO_HIGH': 'Gemini 3 Pro (High)',
  'MODEL_GEMINI_3_FLASH': 'Gemini 3 Flash',
  'MODEL_GEMINI_3_FLASH_LOW': 'Gemini 3 Flash (Low)',
  'MODEL_GEMINI_3_FLASH_MEDIUM': 'Gemini 3 Flash (Medium)',
  'MODEL_GEMINI_3_FLASH_HIGH': 'Gemini 3 Flash (High)',
  'MODEL_GEMINI_2_5_PRO': 'Gemini 2.5 Pro',
  'MODEL_GEMINI_2_5_FLASH': 'Gemini 2.5 Flash',

  // Claude models
  'MODEL_CLAUDE_4_5_SONNET': 'Claude 4.5 Sonnet',
  'MODEL_CLAUDE_4_5_SONNET_THINKING': 'Claude 4.5 Sonnet (Thinking)',
  'MODEL_CLAUDE_4_5_OPUS': 'Claude 4.5 Opus',
  'MODEL_CLAUDE_4_5_OPUS_THINKING': 'Claude 4.5 Opus (Thinking)',
  'MODEL_CLAUDE_3_5_SONNET': 'Claude 3.5 Sonnet',

  // GPT models
  'MODEL_OPENAI_GPT_OSS_120B_MEDIUM': 'GPT OSS 120B (Medium)',
  'MODEL_OPENAI_GPT_4O': 'GPT-4o',

  // Placeholder models (for testing/development)
  'MODEL_PLACEHOLDER_M7': 'Placeholder M7',
  'MODEL_PLACEHOLDER_M8': 'Placeholder M8',
  'MODEL_PLACEHOLDER_M12': 'Placeholder M12',
  'MODEL_PLACEHOLDER_M18': 'Placeholder M18',
  'MODEL_PLACEHOLDER_M19': 'Placeholder M19',
};

/**
 * Common model name patterns and their display names
 */
const MODEL_PATTERNS: Array<{ pattern: RegExp; format: (match: RegExpMatchArray) => string }> = [
  // gemini-3-pro-low, gemini-3-flash-high, etc.
  {
    pattern: /^gemini-(\d+(?:\.\d+)?)-(\w+)(?:-(low|medium|high))?$/i,
    format: (m) => {
      const version = m[1];
      const variant = m[2]?.charAt(0).toUpperCase() + m[2]?.slice(1);
      const tier = m[3] ? ` (${m[3].charAt(0).toUpperCase() + m[3].slice(1)})` : '';
      return `Gemini ${version} ${variant}${tier}`;
    },
  },
  // claude-sonnet-4-5-thinking, claude-opus-4-5, etc.
  {
    pattern: /^claude-(sonnet|opus|haiku)-(\d+)-(\d+)(?:-(thinking))?$/i,
    format: (m) => {
      const variant = m[1]?.charAt(0).toUpperCase() + m[1]?.slice(1);
      const version = `${m[2]}.${m[3]}`;
      const thinking = m[4] ? ' (Thinking)' : '';
      return `Claude ${version} ${variant}${thinking}`;
    },
  },
  // gpt-oss-120b-medium, gpt-4o, etc.
  {
    pattern: /^(?:openai-)?gpt-(.+)$/i,
    format: (m) => {
      const rest = m[1]?.replace(/-/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      return `GPT ${rest}`;
    },
  },
];

/**
 * Extracts thinking tier from model name suffix.
 */
function extractTierSuffix(modelName: string): string | null {
  const tierMatch = modelName.match(/-(minimal|low|medium|high)$/i);
  return tierMatch ? ` (${tierMatch[1].charAt(0).toUpperCase() + tierMatch[1].slice(1)})` : null;
}

/**
 * Translates an API model name to a user-friendly display name.
 * 
 * Examples:
 * - "MODEL_CLAUDE_4_5_SONNET_THINKING" → "Claude 4.5 Sonnet (Thinking)"
 * - "gemini-3-pro-low" → "Gemini 3 Pro (Low)"
 * - "antigravity-claude-sonnet-4-5-thinking-high" → "Claude 4.5 Sonnet (Thinking High)"
 * 
 * @param modelName - The API model name (e.g., from quota response or user config)
 * @returns User-friendly display name
 */
export function translateModelName(modelName: string): string {
  if (!modelName) return 'Unknown Model';
  if (typeof modelName !== 'string') {
    return String(modelName);
  }

  // Strip common prefixes
  let cleaned = modelName
    .replace(/^antigravity-/i, '')
    .replace(/^google\//i, '')
    .replace(/^anthropic\//i, '')
    .replace(/^openai\//i, '');

  // Check direct mappings first
  const directMapping = API_TO_DISPLAY_NAMES[modelName] || API_TO_DISPLAY_NAMES[cleaned.toUpperCase().replace(/-/g, '_').replace(/^MODEL_/, 'MODEL_')];
  if (directMapping) return directMapping;

  // Try pattern matching
  for (const { pattern, format } of MODEL_PATTERNS) {
    const match = cleaned.match(pattern);
    if (match) {
      return format(match);
    }
  }

  // Extract tier if present and format generically
  const tierSuffix = extractTierSuffix(cleaned);
  const baseName = tierSuffix ? cleaned.replace(/-(minimal|low|medium|high)$/i, '') : cleaned;

  // Generic fallback: capitalize and replace hyphens with spaces
  const formatted = baseName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return tierSuffix ? `${formatted}${tierSuffix}` : formatted;
}

/**
 * Gets a short model name for compact display (e.g., in logs or small UI elements).
 * 
 * Examples:
 * - "Claude 4.5 Sonnet (Thinking)" → "Claude 4.5 Sonnet"
 * - "Gemini 3 Pro (High)" → "Gemini 3 Pro"
 * 
 * @param modelName - The model name (API or already translated)
 * @returns Short display name without tier suffixes
 */
export function getShortModelName(modelName: string): string {
  const translated = translateModelName(modelName);
  // Remove tier suffixes in parentheses
  return translated.replace(/\s*\([^)]*\)\s*$/, '');
}

/**
 * Formats model name with quota percentage for toaster display.
 * 
 * @param modelName - The model name
 * @param quotaPercentage - Quota remaining as percentage (0-100)
 * @returns Formatted string for display
 */
export function formatModelQuotaForToast(modelName: string, quotaPercentage: number): string {
  const displayName = translateModelName(modelName);
  const safePercentage = (typeof quotaPercentage === 'number' && !isNaN(quotaPercentage)) ? quotaPercentage : 0;
  const emoji = safePercentage <= 2 ? '🔴' : safePercentage <= 10 ? '🟡' : '🟢';
  return `${emoji} ${displayName}: ${safePercentage.toFixed(0)}%`;
}

/**
 * Formats a model switch notification message.
 * 
 * @param fromModel - The model being switched from
 * @param toModel - The model being switched to
 * @param reason - Reason for switch (e.g., "Quota exhausted", "Below threshold")
 * @returns Formatted notification message
 */
export function formatModelSwitchMessage(fromModel: string, toModel: string, reason: string): string {
  const fromDisplay = translateModelName(fromModel);
  const toDisplay = translateModelName(toModel);
  return `Switching from ${fromDisplay} to ${toDisplay}: ${reason}`;
}
