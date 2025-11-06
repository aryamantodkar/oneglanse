import { TRPCError } from "@trpc/server";
import { slidingWindowLimiter } from "../redis/limiter/slidingWindowLimiter";

const USER_LIMIT = { limit: 5, windowSec: 60 }; // example: 5 req / 60s

export const rateLimitMiddleware = async ({ ctx, next }: any) => {
  // prefer authenticated userId; fallback to IP
  const userId = ctx.session?.user?.id;
  const ip = (ctx.req?.headers["x-forwarded-for"] as string)?.split(",")[0] ?? ctx.req?.socket?.remoteAddress;
  const keyBase = userId ? `user:${userId}` : `ip:${ip ?? "unknown"}`;
  const key = `rl:${keyBase}:api`;

  const { allowed, remaining, resetMs } = await slidingWindowLimiter(key, USER_LIMIT.limit, USER_LIMIT.windowSec);

  // set headers if res is available (helps client)
  if (ctx.res) {
    ctx.res.setHeader("X-RateLimit-Limit", String(USER_LIMIT.limit));
    ctx.res.setHeader("X-RateLimit-Remaining", String(remaining));
    ctx.res.setHeader("X-RateLimit-Reset", String(resetMs)); // ms epoch
    if (!allowed) {
      const retryAfterSec = Math.ceil((resetMs - Date.now()) / 1000);
      ctx.res.setHeader("Retry-After", String(Math.max(1, retryAfterSec)));
    }
  }

  if (!allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded. Try again later." });
  }

  return next();
};