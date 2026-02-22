import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

if (fs.existsSync("apps/agent/.env")) {
	dotenv.config({ path: "apps/agent/.env" });
} else if (fs.existsSync(".env")) {
	dotenv.config();
}

if (!process.env.LOCAL_AUTH_PROFILE_PATH) {
	throw new Error("LOCAL_AUTH_PROFILE_PATH is not set");
}

export const USER_DATA_DIR = path.resolve(process.env.LOCAL_AUTH_PROFILE_PATH);
