import { EnvError } from "@/server/error/errors/EnvError";
import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  throw new EnvError(
    "ANTHROPIC_API_KEY",
    "Missing Anthropic API key. Please set ANTHROPIC_API_KEY in your environment."
  );
}

export const anthropic = new Anthropic({ apiKey });