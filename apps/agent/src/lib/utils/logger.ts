import dotenv from "dotenv";
import fs, { existsSync } from "node:fs";

if (existsSync(".env")) {
  dotenv.config({ path: ".env" });
}

const DEBUG_ENABLED = process.env.DEBUG_ENABLED === 'true';

export const logger = {
  // Always visible
  error: (...args: any[]) => {
    console.error("❌ ", ...args);
  },

  warn: (...args: any[]) => {
    console.warn("⚠️ ", ...args);
  },

  success: (...args: any[]) => {
    console.log("✅ ", ...args);
  },

  // Normal logs (default)
  log: (...args: any[]) => {
    console.log(...args);
  },

  // Extra noisy logs (optional)
  debug: (...args: any[]) => {
    if (!DEBUG_ENABLED) return;
    console.log(...args);
  },
};