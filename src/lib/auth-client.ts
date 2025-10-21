import { createAuthClient } from "better-auth/client"
import { organizationClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
    baseURL:
      typeof window !== "undefined"
        ? process.env.NEXT_PUBLIC_API_URL // browser
        : process.env.APP_URL, // server (Docker)
    plugins: [organizationClient()],
  });