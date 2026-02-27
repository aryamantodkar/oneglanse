import type { FailureType } from "@oneglanse/types";

export type { FailureType };

export function classifyError(err: unknown): FailureType {
	const msg = String((err as any)?.message ?? "").toLowerCase();

	if (/err_proxy|err_connection|err_ssl|err_timed_out/i.test(msg))
		return "connection_error";
	if (/bot.?detect|cloudflare|captcha|turnstile|challenge/i.test(msg))
		return "bot_detection";
	if (
		/logged.?out|login|auth.*missing|session.*invalid|authentication is false/i.test(
			msg,
		)
	)
		return "logged_out";
	if (/rate.?limit|too many|usage.?limit/i.test(msg)) return "rate_limited";
	if (
		/no.*editor|editor.*not.*ready|no_editor|send failed|no send button|no generation|typing failed/i.test(
			msg,
		)
	)
		return "no_editor";
	if (/extraction.*fail|empty.*response/i.test(msg)) return "extraction_failed";
	if (/timed?\s*out/i.test(msg)) return "timeout";
	return "unknown";
}
