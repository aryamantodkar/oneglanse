import type { FailureType } from "@oneglanse/types";
import { toErrorMessage } from "./toErrorMessage.js";

export type { FailureType };

export function classifyError(err: unknown): FailureType {
	const msg = toErrorMessage(err).toLowerCase();

	if (
		/err_proxy|err_connection|err_tunnel|err_ssl|err_timed_out|proxy connect failed|tunnel connection/i.test(
			msg,
		)
	)
		return "connection_error";
	if (/bot.?detect|cloudflare|captcha|turnstile|challenge/i.test(msg))
		return "bot_detection";
	if (
		/rate.?limit|too many|usage.?limit|status\s*429|403.*forbidden|access.?denied/i.test(
			msg,
		)
	)
		return "rate_limited";
	if (
		/no.*editor|editor.*not.*ready|no_editor|send failed|no send button|no generation|typing failed|submission.*failed|submission.*timed? ?out|all submission/i.test(
			msg,
		)
	)
		return "no_editor";
	if (/extraction.*fail|empty.*response/i.test(msg)) return "extraction_failed";
	if (/timed?\s*out/i.test(msg)) return "timeout";
	if (
		/window is null|protocol error|browser has been closed|target crashed|browser.*disconnect/i.test(
			msg,
		)
	)
		return "browser_crash";
	return "unknown";
}
