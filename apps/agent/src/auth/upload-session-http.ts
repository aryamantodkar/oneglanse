import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { logger } from "../lib/utils/logger.js";

// Load .env.local for local authentication
if (existsSync(".env")) {
  dotenv.config({ path: ".env" });
} else {
  throw new Error(".env not found");
}

const VPS_API_URL = process.env.VPS_API_URL || `http://${process.env.VPS_IP}:3333`;
const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN;
const AUTH_PROFILE_PATH = process.env.LOCAL_AUTH_PROFILE_PATH || "./storage";

interface SessionData {
  anthropic?: any;
  openai?: any;
  perplexity?: any;
}

async function uploadSessions() {
  logger.log("📤 Starting session upload via HTTP...");

  if (!API_AUTH_TOKEN) {
    logger.error("API_AUTH_TOKEN not set in environment");
    logger.error("Please set API_AUTH_TOKEN in your .env.local file");
    process.exit(1);
  }

  if (!VPS_API_URL) {
    logger.error("VPS_API_URL or VPS_IP not set in environment");
    logger.error("Please set VPS_IP in your .env.local file");
    process.exit(1);
  }

  // Check VPS health first
  logger.log(`🔍 Checking VPS health at ${VPS_API_URL}/health...`);
  try {
    const healthResponse = await fetch(`${VPS_API_URL}/health`);
    if (!healthResponse.ok) {
      throw new Error(`VPS health check failed: ${healthResponse.status}`);
    }
    const health = await healthResponse.json();
    logger.log("✅ VPS is healthy:", health);
  } catch (err: any) {
    logger.error("Failed to connect to VPS:", err.message);
    logger.error("Make sure the VPS is running and accessible");
    logger.error(`Tried to connect to: ${VPS_API_URL}/health`);
    process.exit(1);
  }

  // Read session files
  const sessions: SessionData = {};
  const providers = ["anthropic", "openai", "perplexity"];

  for (const provider of providers) {
    const authFile = path.join(AUTH_PROFILE_PATH, provider, `${provider}-auth.json`);

    if (!fs.existsSync(authFile)) {
      logger.warn(`Session file not found for ${provider}: ${authFile}`);
      continue;
    }

    try {
      const sessionData = JSON.parse(fs.readFileSync(authFile, "utf-8"));
      sessions[provider as keyof SessionData] = sessionData;
      logger.log(`Read session for ${provider} (${authFile})`);
    } catch (err: any) {
      logger.error(`Failed to read session for ${provider}:`, err.message);
    }
  }

  if (Object.keys(sessions).length === 0) {
    logger.error("No session files found to upload");
    logger.error("Run 'pnpm run login' first to create sessions");
    process.exit(1);
  }

  // Upload sessions to VPS
  logger.log(`📤 Uploading ${Object.keys(sessions).length} sessions to VPS...`);

  try {
    const response = await fetch(`${VPS_API_URL}/upload-sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_AUTH_TOKEN}`,
      },
      body: JSON.stringify(sessions),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    logger.success("Upload successful:", result);

    // Verify sessions on VPS
    logger.log("🔍 Verifying sessions on VPS...");
    const healthCheck = await fetch(`${VPS_API_URL}/health`);
    const health = await healthCheck.json();

    logger.log("\n📊 Session status on VPS:");
    logger.log(`   Anthropic: ${health.sessions.anthropic ? "✅" : "❌"}`);
    logger.log(`   OpenAI: ${health.sessions.openai ? "✅" : "❌"}`);
    logger.log(`   Perplexity: ${health.sessions.perplexity ? "✅" : "❌"}`);

    logger.success("\nSession upload complete!");
    logger.log("👉 You can now run jobs on the VPS");
  } catch (err: any) {
    logger.error("Upload failed:", err.message);
    process.exit(1);
  }
}

uploadSessions();
