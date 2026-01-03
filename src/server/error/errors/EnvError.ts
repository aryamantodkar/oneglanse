import { BaseError } from "./BaseError";

export class EnvError extends BaseError {
    constructor(variable: string, message = "Missing or invalid environment variable", meta?: Record<string, unknown>) {
      super(`${message}: ${variable}`, {
        code: "ENV_ERROR",
        status: 500,
        meta: { variable, ...meta },
      });
    }
  }