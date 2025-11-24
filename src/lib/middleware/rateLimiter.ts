import { slidingWindowAlgorithm } from "../../server/redis/limiter/slidingWindow";
import { fixedWindowAlgorithm } from "../../server/redis/limiter/fixedWindow";
import { RateLimitError } from "../error";

const USER_LIMIT = { limit: 5, windowSec: 60 }; 
const OPENAI_LIMIT = { limit: 60, windowSec: 60 };

function applyRateLimitHeaders(
  res: any,
  { limit, remaining, resetMs, allowed }: any
) {
  try {
    if (!res || typeof res.setHeader !== "function") {
      console.warn("applyRateLimitHeaders: Invalid response object");
      return;
    }

    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(resetMs));

    if (!allowed) {
      const retryAfterSec = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
    }
  } catch (err) {
    console.error("Failed to apply rate limit headers:", err);
  }
}
  
export const slidingWindowRateLimiter = async ({ ctx, next }: any) => {
    if (ctx.isCron) {
      return next(); 
    }

    const userId = ctx.session?.user?.id;
    const ip = (ctx.req?.headers["x-forwarded-for"] as string)?.split(",")[0]
      ?? ctx.req?.socket?.remoteAddress;
    const keyBase = userId ? `user:${userId}` : `ip:${ip ?? "unknown"}`;
    const key = `rl:${keyBase}:api`;
  
    const { allowed, remaining, resetMs } = await slidingWindowAlgorithm(
      key,
      USER_LIMIT.limit,
      USER_LIMIT.windowSec
    );
  
    if (ctx.res) applyRateLimitHeaders(ctx.res, { limit: USER_LIMIT.limit, remaining, resetMs, allowed });
  
    if (!allowed) {
      throw new RateLimitError("API Rate limit exceeded. Try again later.");
    }
  
    return next();
};
  
export const fixedWindowRateLimiter = async ({ ctx, next }: any) => {
    if (ctx.isCron) {
      return next(); 
    }

    const vendorKey = "vendor:openai:o4-mini";
  
    const { allowed, remaining, resetMs } = await fixedWindowAlgorithm(
      vendorKey,
      OPENAI_LIMIT.limit,
      OPENAI_LIMIT.windowSec
    );
  
    if (ctx.res) applyRateLimitHeaders(ctx.res, { limit: OPENAI_LIMIT.limit, remaining, resetMs, allowed });
  
    if (!allowed) {
      throw new RateLimitError("OpenAI capacity reached. Try again later.");
    }
  
    return next();
};