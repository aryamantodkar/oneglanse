import "server-only";

import { redis } from "../redis";

type FixedResult = {
  allowed: boolean;
  count: number;
  remaining: number;
  resetMs: number; // Unix timestamp (seconds) when window resets
};

export async function fixedWindowAlgorithm(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<FixedResult> {
  // Use Redis server time for consistency across distributed systems
  const [serverSeconds] = await redis.time();
  const nowSec = Number(serverSeconds);

  // Compute the current "bucket" number for this fixed window
  const bucket = Math.floor(nowSec / windowSeconds);

  // Unique Redis key for this window
  const windowKey = `${key}:${bucket}`;

  // Atomically increment and set expiry (if new)
  const results = await redis
    .multi()
    .incr(windowKey)
    .expire(windowKey, windowSeconds)
    .exec();

  // Parse the count (first result of the transaction)
  const count = Number(results?.[0]) || 0;

  // Determine if request is allowed
  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);

  // Calculate reset time in Unix seconds (start of next window)
  const resetMs = (bucket + 1) * windowSeconds;

  return { allowed, count, remaining, resetMs };
}