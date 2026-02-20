import { BaseError } from "./BaseError.js";

export class AuthError extends BaseError {
	constructor(message = "Unauthorized", cause?: unknown) {
		super(message, { code: "AUTH_ERROR", status: 401, cause });
	}
}
