import "server-only";

import { fixedWindowAlgorithm } from "@/server/redis/limiter/fixedWindow";
import { slidingWindowAlgorithm } from "@/server/redis/limiter/slidingWindow";
import { AuthError, RateLimitError } from "@/server/error";
import { t } from "../trpc";

const USER_LIMIT = { limit: 5, windowSec: 60 }; 
const OPENAI_LIMIT = { limit: 60, windowSec: 60 };

  
export const slidingWindowRateLimiter = t.middleware(async ({ ctx, next }) => {
  const userId = ctx.session?.user.id;

  if (!userId) {
		throw new AuthError("User Id is undefined.");
	}

  const forwardedFor = ctx.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

  const keyBase = userId ? `user:${userId}` : `ip:${ip}`;
  const key = `rl:${keyBase}:api`;

  const { allowed } = await slidingWindowAlgorithm(
    key,
    USER_LIMIT.limit,
    USER_LIMIT.windowSec
  );

  if (!allowed) {
    throw new RateLimitError(
      "API rate limit exceeded. Try again later."
    );
  }

  return next();
});

export const fixedWindowRateLimiter = t.middleware(async ({ next }) => {
  const vendorKey = "vendor:openai:o4-mini";

  const { allowed } = await fixedWindowAlgorithm(
    vendorKey,
    OPENAI_LIMIT.limit,
    OPENAI_LIMIT.windowSec
  );

  if (!allowed) {
    throw new RateLimitError(
      "OpenAI capacity reached. Try again later."
    );
  }

  return next();
});