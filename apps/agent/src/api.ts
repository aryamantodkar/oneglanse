import dotenv from "dotenv";
import { createServer } from "node:http";
import fs, { existsSync } from "node:fs";
import path from "node:path";
import { logger } from "./lib/utils/logger.js";

// Load .env file if it exists (for local dev), otherwise rely on environment variables
if (existsSync(".env")) {
  dotenv.config({ path: ".env" });
}

const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN || "";

const server = createServer(async (req, res) => {

  if (req.method === "POST" && req.url === "/upload-sessions") {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.replace("Bearer ", "");

    if (!API_AUTH_TOKEN || token !== API_AUTH_TOKEN) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    if (req.headers["content-type"] !== "application/json") {
      res.statusCode = 415;
      res.end(JSON.stringify({ error: "Content-Type must be application/json" }));
      return;
    }

    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > 10e6) {
        res.statusCode = 413;
        res.end("Payload too large");
        req.destroy();
      }
    });

    req.on("end", async () => {
      try {
        const sessions = JSON.parse(body);
        const VPS_AUTH_PROFILE_PATH = process.env.VPS_AUTH_PROFILE_PATH || "./storage";

        const results = {
          anthropic: false,
          openai: false,
          perplexity: false
        };

        for (const provider of ["anthropic", "openai", "perplexity"]) {
          if (sessions[provider]) {
            const providerDir = path.join(VPS_AUTH_PROFILE_PATH, provider);
            const authFile = path.join(providerDir, `${provider}-auth.json`);

            fs.mkdirSync(providerDir, { recursive: true });
            fs.writeFileSync(authFile, JSON.stringify(sessions[provider], null, 2));
            results[provider as keyof typeof results] = true;

            logger.success(`Uploaded session for ${provider}`);
          }
        }

        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        res.end(JSON.stringify({
          ok: true,
          uploaded: results,
          message: "Sessions uploaded successfully"
        }));
      } catch (err: any) {
        logger.error("Session upload error:", err);
        res.statusCode = 400;
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    return;
  }

  res.statusCode = 404;
  res.end("Not Found");
});

server.listen(3333, "0.0.0.0", () => {
  logger.log("🚀 Queue API listening on http://0.0.0.0:3333");
});