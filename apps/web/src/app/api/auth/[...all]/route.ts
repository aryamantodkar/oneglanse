import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { auth } from "@lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { type NextRequest, NextResponse } from "next/server";

const AUTH_RATE_LIMIT = { limit: 20, windowSecs: 60 };
const betterAuthHandler = toNextJsHandler(auth);

async function withRateLimit(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<Response>,
): Promise<Response> {
  const ip = getClientIp(req.headers);
  const { allowed } = await checkRateLimit(`rl:auth:${ip}`, AUTH_RATE_LIMIT);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }
  return handler(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  return withRateLimit(req, (r) => betterAuthHandler.POST(r));
}

export async function GET(req: NextRequest): Promise<Response> {
  return withRateLimit(req, (r) => betterAuthHandler.GET(r));
}
