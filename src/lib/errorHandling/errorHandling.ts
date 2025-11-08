import type { ApiResponse } from "@/server/db/types";
import { TRPCError } from "@trpc/server";
import { parseModelError, trpcErrorToHttpCode } from "../helper/functions";

export function makeResponse<T>(data: T, code: number, message?: string): ApiResponse<T> {
  return { success: true, code, data, message };
}

export function makeError(message: string, code: number): ApiResponse<null> {
  return { success: false, code, data: null, message };
}

export async function safeHandler<T>(fn: () => Promise<ApiResponse<T>>): Promise<ApiResponse<T | null>> {
  try {
    const result = await fn();

    if (
      result &&
      typeof result === "object" &&
      "success" in result &&
      "code" in result &&
      "data" in result &&
      "message" in result
    ) {
      return result;
    }

    return makeResponse(result as T, 200, "Success");
  } catch (err: any) {
    console.error("Error in safeHandler:", err);

    if (err instanceof TRPCError) {
      return makeError(err.message,trpcErrorToHttpCode(err.code));
    }

    return makeError(err?.message ?? "Internal server error", 500);
  }
}

export async function safeCall<T>(
    fn: () => Promise<T>,  
    modelName: string    
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const result = await fn();
      return { success: true, data: result };
    } catch (error: any) {
      let message = parseModelError(error, modelName) ?? "Unknown error occurred.";
  
      console.error(`❌ ${modelName} failed:`, error);
  
      return { success: false, error: message };
    }
  }