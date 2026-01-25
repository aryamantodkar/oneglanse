import "dotenv/config";
import { createServer } from "node:http";
import { agentQueue } from "./queue.js";
import { redis } from "./redis.js";
import fs from "node:fs";
import path from "node:path";
import { logger } from "./lib/utils/logger.js";

const API_AUTH_TOKEN = process.env.API_AUTH_TOKEN || "";

const server = createServer(async (req, res) => {
  // -------------------------
  // GET /health
  // -------------------------
  if (req.method === "GET" && req.url === "/health") {
    const AUTH_PROFILE_PATH = process.env.AUTH_PROFILE_PATH || "./storage";

    const healthStatus = {
      status: "ok",
      timestamp: new Date().toISOString(),
      redis: false,
      sessions: {
        anthropic: fs.existsSync(path.join(AUTH_PROFILE_PATH, "anthropic", "anthropic-auth.json")),
        openai: fs.existsSync(path.join(AUTH_PROFILE_PATH, "openai", "openai-auth.json")),
        perplexity: fs.existsSync(path.join(AUTH_PROFILE_PATH, "perplexity", "perplexity-auth.json"))
      }
    };

    try {
      await redis.ping();
      healthStatus.redis = true;
    } catch (err) {
      healthStatus.redis = false;
    }

    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify(healthStatus));
    return;
  }

  // -------------------------
  // POST /upload-sessions (for session transfer via HTTP)
  // -------------------------
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
        const AUTH_PROFILE_PATH = process.env.AUTH_PROFILE_PATH || "./storage";

        const results = {
          anthropic: false,
          openai: false,
          perplexity: false
        };

        for (const provider of ["anthropic", "openai", "perplexity"]) {
          if (sessions[provider]) {
            const providerDir = path.join(AUTH_PROFILE_PATH, provider);
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

  // -------------------------
  // GET /jobs/:id
  // -------------------------
  if (req.method === "GET" && req.url?.startsWith("/jobs/")) {
    const jobId = req.url.split("/")[2];

    const data = await redis.get(`job:${jobId}:result`);

    res.setHeader("Content-Type", "application/json");

    if (!data) {
      res.statusCode = 202;
      res.end(JSON.stringify({ status: "pending" }));
      return;
    }

    res.statusCode = 200;
    res.end(data);
    return;
  }

  // -------------------------
  // POST /enqueue
  // -------------------------
  if (req.method === "POST" && req.url === "/enqueue") {
    if (req.headers["content-type"] !== "application/json") {
      res.statusCode = 415;
      res.end(JSON.stringify({ error: "Content-Type must be application/json" }));
      return;
    }

    let body = "";

    req.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1e6) {
        res.statusCode = 413;
        res.end("Payload too large");
        req.destroy();
      }
    });

    req.on("end", async () => {
      try {
        const parsed = JSON.parse(body);
        const { headless = true, prompts } = parsed;

        if (!Array.isArray(prompts)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "prompts must be an array" }));
          return;
        }

        const job = await agentQueue.add("run-agent", {
          headless,
          prompts,
        });

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, jobId: job.id }));
      } catch (err: any) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: err.message }));
      }
    });

    return;
  }

  // -------------------------
  // Fallback 404
  // -------------------------
  res.statusCode = 404;
  res.end("Not Found");
});

server.listen(3333, "0.0.0.0", () => {
  logger.log("🚀 Queue API listening on http://0.0.0.0:3333");
});