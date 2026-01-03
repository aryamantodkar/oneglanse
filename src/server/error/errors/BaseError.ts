import "server-only";

export class BaseError extends Error {
    public readonly code: string;
    public readonly status: number;
    public readonly isOperational: boolean;
    public readonly meta?: Record<string, unknown>;
    public readonly cause?: unknown;
  
    constructor(
      message: string,
      options: {
        code?: string;
        status?: number;
        isOperational?: boolean;
        meta?: Record<string, unknown>;
        cause?: unknown;
      } = {}
    ) {
      const { code = "INTERNAL_ERROR", status = 500, isOperational = true, meta, cause } = options;
      super(message);
  
      Object.setPrototypeOf(this, new.target.prototype);
  
      this.name = new.target.name;
      this.code = code;
      this.status = status;
      this.isOperational = isOperational;
      this.meta = meta;
      this.cause = cause;
  
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      }
    }
}