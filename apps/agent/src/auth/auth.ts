import { execSync } from "child_process";
import { logger } from "../lib/utils/logger.js";

function run(cmd: string) {
  logger.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

async function main() {
  logger.log("🔐 Starting authentication flow");

  run("pnpm run login");         // headed, user logs in
  run("pnpm run upload-session-http"); // send to VPS

  logger.log("✅ Authentication flow complete");
  logger.log("👉 You can now start/restart the agent on the VPS");
}

main();