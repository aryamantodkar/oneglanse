import { createAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";
import { env } from "@/env";

export const authClient = createAuthClient({
	baseURL:
		typeof window !== "undefined"
			? env.NEXT_PUBLIC_API_URL // browser
			: env.APP_URL, // server (Docker)
	plugins: [organizationClient()],
});
