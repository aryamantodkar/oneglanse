import type { ApiResponse } from "@/server/db/types";
import { TRPCError } from "@trpc/server";

export function makeResponse<T>(data: T, message?: string): ApiResponse<T> {
  return { success: true, data, message };
}

export function makeError(message: string): ApiResponse<null> {
  return { success: false, data: null, message };
}

export async function safeHandler<T>(fn: () => Promise<ApiResponse<T>>): Promise<ApiResponse<T | null>> {
  try {
    const result = await fn();

    if (
      result &&
      typeof result === "object" &&
      "success" in result &&
      "data" in result &&
      "message" in result
    ) {
      return result;
    }

    return makeResponse(result as T, "Success");
  } catch (err: any) {
    console.error("Error in safeHandler:", err);

    // ✅ Known TRPC errors — convert to standard format
    if (err instanceof TRPCError) {
      return makeError(err.message);
    }

    // ✅ Unknown/unexpected errors
    return makeError(err?.message ?? "Internal server error");
  }
}
// LLM Error Handling
export async function safeCall<T>(
    fn: () => Promise<T>,  
    modelName: string    
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const result = await fn();
      return { success: true, data: result };
    } catch (error: any) {
      let message = "Unknown error occurred.";
  
      if (error.response?.status === 401) {
        message = `${modelName}: Invalid or missing API key.`;
      } else if (error.response?.status === 429) {
        message = `${modelName}: Rate limit exceeded.`;
      } else if (error.response?.status === 402) {
        message = `${modelName}: Insufficient credits.`;
      } else if (error.code === "ENOTFOUND") {
        message = `${modelName}: Network error, service unreachable.`;
      } else if (error.message?.includes("timeout")) {
        message = `${modelName}: Request timed out.`;
      } else if (typeof error.message === "string") {
        message = `${modelName}: ${error.message}`;
      }
  
      console.error(`❌ ${modelName} failed:`, error);
  
      return { success: false, error: message };
    }
  }