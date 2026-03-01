import "server-only";
import { redis } from "@oneglanse/services";

export interface RateLimitConfig {
  limit: number;
  windowSecs: number;
}

// Atomic INCR + conditional EXPIRE — sets TTL only on first request (count === 1).
// Ensures TTL is never reset mid-window and avoids TTL-less keys on crash.
const RATE_LIMIT_LUA = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return current
`;

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    if (first) return first.trim();
  }
  return headers.get("x-real-ip")?.trim() ?? "unknown";
}

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean }> {
  try {
    const count = (await redis.eval(
      RATE_LIMIT_LUA,
      1,
      key,
      String(config.windowSecs),
    )) as number;
    return { allowed: count <= config.limit };
  } catch {
    return { allowed: true }; // fail open — Redis outage must not block all traffic
  }
}
