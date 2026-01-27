import "./api.js";
import "./worker.js";

const shutdown = async (signal: string) => {
  console.log(`[agent] Received ${signal}. Shutting down...`);

  try {
  } catch (err) {
    console.error("[agent] Shutdown error:", err);
  } finally {
    process.exit(0);
  }
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("SIGQUIT", shutdown);

process.on("uncaughtException", (err) => {
  console.error("[agent] Uncaught exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[agent] Unhandled rejection:", reason);
  process.exit(1);
});