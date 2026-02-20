import { BaseError } from "./BaseError.js";

export class ValidationError extends BaseError {
	constructor(
		message = "Validation failed",
		meta?: Record<string, unknown>,
		cause?: unknown,
	) {
		super(message, { code: "VALIDATION_ERROR", status: 400, meta, cause });
	}
}
