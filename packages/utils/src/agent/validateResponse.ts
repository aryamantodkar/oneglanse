import type { Provider } from "@oneglanse/types";

const DEFAULT_MIN_RESPONSE_CHARS = Number(process.env["MIN_RESPONSE_CHARS"] ?? 600);

// AI Overview is a SERP feature, not a chat model — valid responses are often
// 150-400 chars for simple queries. Using the chat-model threshold rejects
// real answers and triggers unnecessary retries / IP rotations.
const PROVIDER_MIN_RESPONSE_CHARS: Partial<Record<Provider, number>> = {
	"ai-overview": 100,
};

/**
 * Known false/garbage response patterns across all providers.
 * Ordered from most specific to most general.
 */
const FALSE_RESPONSE_PATTERNS: RegExp[] = [
	// Gemini terms / disclaimer footer
	/google terms.*opens in a new window.*apply/i,
	/gemini is ai and can make mistakes/i,
	/google privacy policy.*apply/i,
	// CAPTCHA / bot detection
	/our systems have detected unusual traffic/i,
	/please verify you('re| are) human/i,
	// Rate limiting
	/too many requests/i,
	// Downtime / unavailable
	/service is (currently )?unavailable/i,
	// Auth walls / session expiry
	/sign in to (continue|use|access)/i,
	/you('ve| have) been logged out/i,
	/access denied/i,
];

type ValidationResult =
	| { valid: true }
	| { valid: false; reason: string };

export function validateResponse(
	response: string,
	provider: Provider,
): ValidationResult {
	const trimmed = response.trim();
	const minChars = PROVIDER_MIN_RESPONSE_CHARS[provider] ?? DEFAULT_MIN_RESPONSE_CHARS;

	if (trimmed.length < minChars) {
		return {
			valid: false,
			reason: `Response too short (${trimmed.length} chars, min ${minChars})`,
		};
	}

	for (const pattern of FALSE_RESPONSE_PATTERNS) {
		if (pattern.test(trimmed)) {
			return {
				valid: false,
				reason: `False/garbage response detected — matched: "${pattern}"`,
			};
		}
	}

	return { valid: true };
}
