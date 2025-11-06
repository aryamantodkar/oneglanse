import { redis } from "../redis";

export type SlidingResult = {
  allowed: boolean;
  count: number;
  remaining: number;
  resetMs: number;
};

const SLIDING_LUA = `
-- KEYS[1] = key
-- ARGV[1] = window_ms
-- ARGV[2] = limit

local key = KEYS[1]
local window = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])

-- get Redis server time to avoid clock drift
local t = redis.call("TIME")
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local cutoff = now - window

-- create a unique member ID (timestamp:random)
local rand = tostring(math.random(100000,999999))
local member = tostring(now) .. ":" .. rand

-- add current event (score = timestamp)
redis.call("ZADD", key, now, member)

-- remove events outside window
redis.call("ZREMRANGEBYSCORE", key, 0, cutoff)

-- count remaining events in the window
local count = redis.call("ZCARD", key)

-- set TTL for automatic cleanup (only if key exists)
if count > 0 then
  redis.call("PEXPIRE", key, window)
end

-- compute reset time = when the earliest event expires
local earliest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
local reset_ms = now + window
if #earliest > 0 then
  local earliest_score = tonumber(earliest[2])
  reset_ms = earliest_score + window
end

return {count, reset_ms}
`;

export async function slidingWindowLimiter(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<SlidingResult> {
  const windowMs = windowSeconds * 1000;

  const result = (await redis.eval(SLIDING_LUA, {
    keys: [key],
    arguments: [windowMs.toString(), limit.toString()],
  })) as [number, number];

  const count = Number(result[0]);
  const resetMs = Number(result[1]);
  const allowed = count <= limit;
  const remaining = Math.max(0, limit - count);

  return { allowed, count, remaining, resetMs };
}