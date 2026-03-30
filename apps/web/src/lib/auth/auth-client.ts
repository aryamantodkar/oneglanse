import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";
import { env } from "@/env";

function resolveAuthClientBaseUrl(): string {
	if (typeof window !== "undefined") {
		return window.location.origin;
	}

	return env.APP_URL ?? env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
}

export const authClient = createAuthClient({
	baseURL: resolveAuthClientBaseUrl(),
	plugins: [organizationClient()],
});
