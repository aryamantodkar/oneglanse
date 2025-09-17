import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/server/db/index"; // your drizzle instance
import { nextCookies } from "better-auth/next-js";
import * as schema from "@/server/db/schema";
import * as authSchema from "@/server/db/auth-schema";
import { organization } from "better-auth/plugins";
import { getActiveOrganization } from "@/server/api/routers/organizations";

export const auth = betterAuth({
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
                const organization = await getActiveOrganization(session.userId);
                return {
                data: {
                    ...session,
                    activeOrganizationId: organization?.id,
                },
                };
            },
            },
        },
    },
    database: drizzleAdapter(db, {
        provider: "pg", // or "mysql", "sqlite"
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