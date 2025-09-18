import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { auth } from "@lib/auth";
import { db, schema } from "@/server/db";
import type { Workspace } from "@/server/db/types";
import { newId } from "@lib/id";

export const workspaceRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(50),
        slug: z.string().min(2).max(50),
      })
    )
    .mutation(async ({ ctx, input }) => {
        const headers = ctx.headers
        const userId = ctx.session?.user.id

        if(!headers || !userId){
            console.log(headers, userId)
            throw new TRPCError({
                code: "UNAUTHORIZED",
                message:
                "Unable to authenticate the user. Please make sure you are logged in and try again",
            });
        }

        const orgData = await auth.api.createOrganization({
            body: {
                name: input.name, 
                slug: input.slug, 
                keepCurrentActiveOrganization: true,
            },
            headers
        })
        .catch((err) => {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Could not create an Organization ${err} `
            })
        })

        if(!orgData?.id){
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "No Org ID found"
            })
        }

        const workspace: Workspace = {
            id: newId("workspace"),
            name: input.name,
            slug: input.slug,
            tenantId: orgData.id,
            createdAt: new Date(),
            deletedAt: null,
        };

        await db.insert(schema.workspaces).values(workspace)
        .catch((err) => {
            throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Unable to create a workspace ${err}`
            })
        })

        return (
            {
                workspace: workspace,
                org: orgData
            }
        )
    }),
});