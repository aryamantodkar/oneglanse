import { z } from "zod";
import { createTRPCRouter } from "@/server/api/trpc";
import { AuthError, safeHandler, ok, ValidationError } from "@/lib/error";
import { createNewWorkspace, getWorkspaceById } from "@/server/services/workspace/workspace";
import { authorizedWorkspaceProcedure, protectedProcedure } from "../../procedures";

export const workspaceRouter = createTRPCRouter({
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2).max(50),
          slug: z.string().min(2).max(50),
          domain: z.string().min(2).max(50),
          country: z.string().min(2), 
          region: z.string().nullable().optional(), 
        })
      )
      .mutation(async ({ input, ctx }) => {
        return safeHandler(async () => {
          const {
            user: { id: userId },
            headers,
          } = ctx;

          const { name, slug, domain, country, region } = input;

          if (!name || !domain || !slug || !country) {
            throw new ValidationError("Please fill all the mandatory fields.");
          }
    
          const res = await createNewWorkspace({name, slug, domain, country, region, userId, headers });

          return ok(res, "Workspace created successfully.");
        })
      }),
    getById: authorizedWorkspaceProcedure
      .input(
        z.object({
          workspaceId: z.string().min(1),
        })
      )
      .query(async ({ ctx }) => {
        return safeHandler(async () => {
          const {
            workspaceId,
          } = ctx;
    
          const res = await getWorkspaceById({ workspaceId });
    
          return ok(res, "Successfully fetched workspace by ID.");
        })
      }),
  });