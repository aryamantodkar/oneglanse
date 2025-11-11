import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { auth } from "@lib/auth/auth";
import { db, schema } from "@/server/db";
import type { Workspace } from "@/server/db/types";
import { newId } from "@/lib/workspace/id";
import { eq, isNull, and } from "drizzle-orm";
import { AuthError, safeHandler, ValidationError, NotFoundError, ok } from "@/server/error";

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
        return safeHandler(async () => {
          const headers = ctx.headers;
          const userId = ctx.session?.user.id;
    
          if (!headers || !userId) {
            throw new AuthError("Headers or userId are undefined.");
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
    
          if (!orgData?.id) {
            throw new ValidationError("Organization ID is undefined.");
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
    
          return ok({ workspace, org: orgData }, "Workspace created successfully.")
        })
      }),
    getById: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().min(1),
        })
      )
      .query(async ({ input, ctx }) => {
        return safeHandler(async () => {
          const userId = ctx.session?.user.id;
          if (!userId) {
            throw new AuthError("User Id is undefined.");
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
            throw new NotFoundError(`Workspace with ID ${input.workspaceId} not found.`);
          }
    
          return ok(workspace[0], "Successfully fetched workspace by ID.");
        })
      }),
  });