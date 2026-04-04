import { env } from "@/env";
import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";

function resolveAuthClientBaseUrl(): string {
	if (typeof window !== "undefined") {
		return window.location.origin;
	}

	return env.APP_URL ?? env.API_BASE_URL ?? "http://localhost:3000";
}

export const authClient = createAuthClient({
	baseURL: resolveAuthClientBaseUrl(),
	plugins: [organizationClient()],
});
