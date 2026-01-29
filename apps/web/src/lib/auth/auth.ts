import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@onescope/db";
import * as authSchema from "../../../../../packages/db/src/schema/auth";
import { organization } from "better-auth/plugins";
import { getActiveOrganization } from "../workspace/getActiveOrganization";

// Lazy initialization to avoid validation during build time
let _auth: ReturnType<typeof betterAuth> | null = null;

function createAuth() {
    return betterAuth({
        secret: process.env.BETTER_AUTH_SECRET,
        socialProviders: {
            google: {
                clientId: process.env.GOOGLE_CLIENT_ID as string,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
            },
        },
        emailAndPassword: {
            enabled: true,
        },
        databaseHooks: {
            session: {
                create: {
                    before: async (session) => {
                        const org = await getActiveOrganization(session?.userId);
                        return {
                            data: {
                                ...session,
                                activeOrganizationId: org?.id ?? null,
                            },
                        };
                    },
                },
            },
        },
        database: drizzleAdapter(db, {
            provider: "pg",
            schema: {
                ...schema,
                ...authSchema
            }
        }),
        plugins: [
            organization(),
            nextCookies()
        ]
    });
}

type Auth = ReturnType<typeof createAuth>;

// Export a proxy that lazily initializes auth on first use
export const auth: Auth = new Proxy({} as Auth, {
    get(_target, prop) {
        if (!_auth) {
            _auth = createAuth();
        }
        const value = _auth[prop as keyof Auth];
        if (typeof value === "function") {
            return value.bind(_auth);
        }
        return value;
    },
});