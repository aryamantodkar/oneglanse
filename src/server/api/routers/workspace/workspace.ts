import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { AuthError, safeHandler, ok, ValidationError } from "@/lib/error";
import { createNewWorkspace, getWorkspaceById } from "@/server/services/workspace/workspace";

export const workspaceRouter = createTRPCRouter({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2).max(50),
          slug: z.string().min(2).max(50),
          country: z.string().min(2), 
          region: z.string().nullable().optional(), 
        })
      )
      .mutation(async ({ ctx, input }) => {
        return safeHandler(async () => {
          const headers = ctx.headers;
          const userId = ctx.session?.user.id;
          const { name, slug, country, region } = input;

          if (!headers || !userId) {
            throw new AuthError("Headers or userId are undefined.");
          }

          if (!name || !slug || !country) {
            throw new ValidationError("Name, Region or Country is missing.");
          }
    
          const res = await createNewWorkspace({name, slug, country, region, userId, headers });

          return ok(res, "Workspace created successfully.");
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
          const { workspaceId } = input;

          if (!userId) {
            throw new AuthError("User Id is undefined.");
          }

          if (!workspaceId || workspaceId.trim() === "") {
            throw new ValidationError("Workspace ID is undefined.");
          }
    
          const res = await getWorkspaceById({ workspaceId, userId });
    
          return ok(res, "Successfully fetched workspace by ID.");
        })
      }),
  });