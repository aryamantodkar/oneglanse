import "server-only";

import { BaseError } from "./BaseError";

export class DatabaseError extends BaseError {
    constructor(message = "Database operation failed", meta?: Record<string, unknown>, cause?: unknown) {
      super(message, { code: "DB_ERROR", status: 500, isOperational: false, meta, cause });
    }
  }