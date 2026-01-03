import { BaseError } from "./BaseError";

export class ExternalServiceError extends BaseError {
  constructor(
    provider: string,
    message = "External service error",
    status = 502,
    meta?: Record<string, unknown>,
    cause?: unknown
  ) {
    super(`${provider}: ${message}`, { code: "EXTERNAL_SERVICE_ERROR", status, meta, cause });
  }
}