import { EnvError } from "@/lib/error/errors/EnvError";
import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new EnvError(
    "OPENAI_API_KEY",
    "Missing OpenAI API key. Please set OPENAI_API_KEY in your environment."
  );
}

export const openai = new OpenAI({ apiKey });