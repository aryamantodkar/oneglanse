import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db"; // your Drizzle client
import { v4 as uuidv4 } from "uuid";
import { brands } from "@/server/db/schema/brand";
import { eq } from "drizzle-orm";
import { makeError, makeResponse, safeHandler } from "@/lib/errorHandling/errorHandling";
import { TRPCError } from "@trpc/server";

export const brandRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string().min(1),
        slug: z.string().optional(),
        website: z.string().url().optional(),
        logoUrl: z.string().url().optional(),
        description: z.string().optional(),
        industry: z.string().optional(),
        competitors: z
          .array(
            z.object({
              id: z.string().optional(),
              name: z.string(),
              website: z.string().url().optional(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
        return safeHandler(async () => {
          const { workspaceId } = input;
          const userId = ctx.session?.user.id;

          if (!userId) {
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "User is not logged in.",
            });
          }
          
          if (!workspaceId || workspaceId.trim() === "") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Missing workspaceId.",
            });
          }

          const results = await db.insert(brands).values({
            id: uuidv4(),
            workspaceId: input.workspaceId,
            name: input.name,
            slug: input.slug ?? null,
            website: input.website ?? null,
            logoUrl: input.logoUrl ?? null,
            description: input.description ?? null,
            industry: input.industry ?? null,
            competitors: input.competitors?.map(c => ({
              id: c.id ?? uuidv4(),
              name: c.name,
              website: c.website ?? undefined,
            })) ?? [],
          });

          return makeResponse(results, 200, "Created brand successfully.");
        })
    }),
  get: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const userId = ctx.session?.user.id;

        if (!userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User is not logged in.",
          });
        }

        const brand = await db
          .select()
          .from(brands)
          .where(eq(brands.workspaceId, input.workspaceId))
          .limit(1);

        if (!brand || brand.length === 0) {
          return makeError("No brand found for this workspace", 404);
        }

        return makeResponse(brand[0], 200, "Fetched brand successfully.");
      })
    }),
  update: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        name: z.string().optional(),
        slug: z.string().optional(),
        website: z.string().optional(), // accept empty string
        logoUrl: z.string().url().optional(),
        description: z.string().optional(),
        industry: z.string().optional(),
        competitors: z
          .array(
            z.object({
              id: z.string().optional(),
              name: z.string(),
              website: z.string().optional(), // accept empty string
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return safeHandler(async () => {
        const userId = ctx.session?.user.id;
        const { workspaceId } = input
        
        if (!userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User is not logged in.",
          });
        }
        
        if (!workspaceId || workspaceId.trim() === "") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Missing workspaceId.",
          });
        }

        const competitors = input.competitors?.map((c) => ({
          id: c.id || uuidv4(),
          name: c.name,
          website: c.website || "", // allow empty string
        }));
  
        // Update the brand
        const result = await db
          .update(brands)
          .set({
            name: input.name ?? undefined,
            slug: input.slug ?? undefined,
            website: input.website ?? "", // allow empty string
            logoUrl: input.logoUrl ?? undefined,
            description: input.description ?? undefined,
            industry: input.industry ?? undefined,
            competitors: competitors ?? undefined,
            updatedAt: new Date(),
          })
          .where(eq(brands.workspaceId, input.workspaceId));
  
        return makeResponse(result, 200, "Updated brand successfully.");
      })
    })
});