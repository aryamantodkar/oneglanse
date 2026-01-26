import { EnvError } from "@onescope/errors";
import OpenAI from "openai";

let _openai: OpenAI | null = null;

export function getOpenai(): OpenAI {
  if (_openai) return _openai;

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new EnvError(
      "OPENAI_API_KEY",
      "Missing OpenAI API key. Please set OPENAI_API_KEY in your environment."
    );
  }

  _openai = new OpenAI({ apiKey });
  return _openai;
}