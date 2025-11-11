import { BaseError } from "./BaseError";

export class NotFoundError extends BaseError {
  constructor(resource = "Resource", meta?: Record<string, unknown>, cause?: unknown) {
    super(`${resource} not found`, { code: "NOT_FOUND", status: 404, meta, cause });
  }
}