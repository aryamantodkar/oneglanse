import fs from "node:fs";
import dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
	if (fs.existsSync("apps/agent/.env")) {
		dotenv.config({ path: "apps/agent/.env" });
	} else if (fs.existsSync(".env")) {
		dotenv.config();
	}
}
