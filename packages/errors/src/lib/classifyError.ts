import type { FailureType } from "@oneglanse/types";
import { toErrorMessage } from "./toErrorMessage.js";

export type { FailureType };

export function classifyError(err: unknown): FailureType {
	const msg = toErrorMessage(err).toLowerCase();

	if (
		// Chromium format: ERR_SSL_*, ERR_PROXY_*, ERR_CONNECTION_*, ERR_TUNNEL_*, ERR_TIMED_OUT
		// Firefox/Camoufox format: SSL_ERROR_*, PR_CONNECT_*, SEC_ERROR_*
		/err_proxy|err_connection|err_tunnel|err_ssl|err_timed_out|proxy connect failed|tunnel connection|ssl_error|pr_connect|sec_error/i.test(
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
		// submission.*timed? ?out is intentionally excluded — it maps to "timeout" below.
		// "All submission methods failed" stays here: it means no submit path worked,
		// which is an editor/UI problem, not a timeout.
		/no.*editor|editor.*not.*ready|no_editor|send failed|no send button|no generation|typing failed|submission.*failed|all submission/i.test(
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
