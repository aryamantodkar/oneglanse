// DEBUG_ENABLED is read from environment variables
// In development: set in .env.local
// In production: set in .env.vps (loaded by Docker)
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