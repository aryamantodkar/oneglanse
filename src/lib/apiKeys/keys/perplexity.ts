import { EnvError } from '@/lib/error/errors/EnvError';
import Perplexity from '@perplexity-ai/perplexity_ai';

const apiKey = process.env.PERPLEXITY_API_KEY;

if (!apiKey) {
  throw new EnvError(
    "PERPLEXITY_API_KEY",
    "Missing Perplexity API key. Please set PERPLEXITY_API_KEY in your environment."
  );
}

export const perplexity = new Perplexity({ apiKey });