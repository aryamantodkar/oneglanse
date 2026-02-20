import { BaseError } from "./BaseError.js";

export class RateLimitError extends BaseError {
	constructor(namespace = "global", message?: string) {
		super(message ?? `${namespace} rate limit exceeded`, {
			code: "RATE_LIMIT_EXCEEDED",
			status: 429,
			meta: { namespace },
		});
	}
}
