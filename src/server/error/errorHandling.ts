import type { ApiResponse } from "@/server/db/types";
import { BaseError } from "./errors/BaseError";
import { captureException } from "./logger";
  
export function ok<T>(data: T | null = null, message = "Success"): ApiResponse<T> {
    return { success: true, status: 200, message, data };
}

export function fail(message = "Internal Server Error", status = 500, code?: string, meta?: Record<string, unknown>) {
    return { success: false, status, code, message, data: null, meta };
}

export function mapErrorToResponse(err: unknown): ApiResponse<null> {
    if (err instanceof BaseError) {
      return fail(err.message, err.status, err.code, err.meta);
    }
  
    const anyErr = err as any;
    const status = anyErr?.response?.status ?? anyErr?.status;
    if (typeof status === "number") {
      const message = anyErr?.response?.data?.message ?? anyErr?.message ?? `External error (${status})`;
      return fail(message, status, "EXTERNAL_HTTP_ERROR");
    }
  
    if (err instanceof Error) {
      return fail(err.message, 500, "UNHANDLED_ERROR");
    }
  
    return fail("Unknown error occurred", 500, "UNKNOWN_ERROR");
}

export async function safeHandler<T>(fn: () => Promise<ApiResponse<T> | T>): Promise<ApiResponse<T | null>> {
  try {
    const result = await fn();
    if (result && typeof result === "object" && "success" in result) {
      return result as ApiResponse<T>;
    }
    return ok(result as T);
  } catch (err) {
    captureException(err);
    return mapErrorToResponse(err);
  }
}