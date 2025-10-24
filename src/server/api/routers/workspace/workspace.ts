import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { auth } from "@lib/auth";
import { db, schema } from "@/server/db";
import type { Workspace } from "@/server/db/types";
import { newId } from "@lib/id";
import { eq, isNull, and } from "drizzle-orm";

export const workspaceRouter = createTRPCRouter({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2).max(50),
          slug: z.string().min(2).max(50),
          country: z.string().min(2), 
          region: z.string().nullable().optional(), // optional region
        })
      )
      .mutation(async ({ ctx, input }) => {
        const headers = ctx.headers;
        const userId = ctx.session?.user.id;
  
        if (!headers || !userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message:
              "Unable to authenticate the user. Please make sure you are logged in and try again",
          });
        }
  
        // Create org
        const orgData = await auth.api
          .createOrganization({
            body: {
              name: input.name,
              slug: input.slug,
              keepCurrentActiveOrganization: true,
            },
            headers,
          })
          .catch((err) => {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Could not create an Organization: ${err}`,
            });
          });
  
        if (!orgData?.id) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No Org ID found",
          });
        }
  
        // Create workspace with country and region
        const workspace: Workspace = {
          id: newId("workspace"),
          name: input.name,
          slug: input.slug,
          tenantId: orgData.id,
          country: input.country, // new field
          region: input.region || null, // new field
          createdAt: new Date(),
          deletedAt: null,
        };
  
        await db
          .insert(schema.workspaces)
          .values(workspace)
          .catch((err) => {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Unable to create a workspace: ${err}`,
            });
          });
  
        return {
          workspace,
          org: orgData,
        };
      }),
    getById: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().min(1),
        })
      )
      .query(async ({ input, ctx }) => {
        const userId = ctx.session?.user.id;
        if (!userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User must be logged in to access workspace.",
          });
        }
  
        const workspace = await db
          .select()
          .from(schema.workspaces)
          .where(
            and(
              eq(schema.workspaces.id, input.workspaceId),
              isNull(schema.workspaces.deletedAt)
            )
          )
          .execute();

        if (!workspace || workspace.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Workspace with ID ${input.workspaceId} not found.`,
          });
        }
  
        return workspace[0]; // workspace object
      }),
  });