
import { BaseError } from "@onescope/errors";
import type { ErrorPayload } from "@onescope/types";


export function toErrorPayload(err: unknown): ErrorPayload {
  // ✅ unified handling
  if (err instanceof BaseError) {
    if (err.code === "AUTH_ERROR") {
      return {
        type: "AUTH",
        message: err.message,
        status: 401,
        retryable: false,
      };
    }

    return {
      type: "UNKNOWN",
      message: err.message,
      code: err.code,
      status: err.status,
      retryable: false,
    };
  }

  // Native error
  if (err instanceof Error) {
    return {
      type: "UNKNOWN",
      message: err.message,
      retryable: false,
    };
  }

  return {
    type: "UNKNOWN",
    message: "Unknown error",
  };
}