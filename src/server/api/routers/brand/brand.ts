import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { db } from "@/server/db"; // your Drizzle client
import { v4 as uuidv4 } from "uuid";
import { brands } from "@/server/db/schema/brand";
import { eq } from "drizzle-orm";

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
        const { workspaceId } = input;
        const userId = ctx.session?.user.id;

        if (!userId) {
            throw new Error("Unauthorized");
        }

        if (!workspaceId || workspaceId.trim() === "") {
            throw new Error("Missing workspaceId");
        }

      try {
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

        return {
          success: true,
          results,
          error: null
        };
      } catch (err) {
        console.error("Failed to create brand:", err);
        return {
          success: false,
          results: [],
          error: "Could not create brand",
        };
      }
    }),
  get: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session?.user.id;

      if (!userId) {
        throw new Error("Unauthorized");
      }

      try {
        const brand = await db
          .select()
          .from(brands)
          .where(eq(brands.workspaceId, input.workspaceId))
          .limit(1);

        if (!brand || brand.length === 0) {
          return {
            success: false,
            brand: null,
            error: "No brand found for this workspace",
          };
        }

        return {
          success: true,
          brand: brand[0],
          error: null,
        };
      } catch (err) {
        console.error("Failed to fetch brand:", err);
        return {
          success: false,
          brand: null,
          error: "Could not fetch brand",
        };
      }
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
      const userId = ctx.session?.user.id;
      if (!userId) throw new Error("Unauthorized");
      if (!input.workspaceId) throw new Error("Missing workspaceId");
  
      try {
        // Prepare competitors with guaranteed IDs
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
  
        return { success: true, result, error: null };
      } catch (err) {
        console.error("Failed to update brand:", err);
        return { success: false, result: null, error: "Could not update brand" };
      }
    })
});