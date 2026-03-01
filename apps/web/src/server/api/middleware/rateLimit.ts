import "server-only";
import { TRPCError } from "@trpc/server";
import { checkRateLimit, getClientIp, type RateLimitConfig } from "@/lib/rate-limit";
import { t } from "../trpc";

/**
 * Returns a tRPC middleware that enforces a per-user fixed-window rate limit.
 * Identifier: ctx.session.user.id (falls back to client IP for unauthenticated paths).
 * Key format: rl:{keyPrefix}:{identifier}
 *
 * Usage: procedure.use(createRateLimiter("agent.run", { limit: 3, windowSecs: 60 }))
 */
export function createRateLimiter(keyPrefix: string, config: RateLimitConfig) {
  return t.middleware(async ({ ctx, next }) => {
    const identifier = ctx.session?.user?.id ?? getClientIp(ctx.headers);
    const { allowed } = await checkRateLimit(`rl:${keyPrefix}:${identifier}`, config);

    if (!allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Rate limit exceeded. Please slow down.",
      });
    }

    return next();
  });
}
