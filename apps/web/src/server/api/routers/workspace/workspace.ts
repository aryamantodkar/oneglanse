import "server-only";

import { z } from "zod";
import { createTRPCRouter } from "@/server/api/trpc";
import { safeHandler, ok, ValidationError, NotFoundError } from "@onescope/errors";
import {
  getWorkspaceById,
  getWorkspacesForUser,
  getWorkspaceMembersWithUsers,
  addMemberToWorkspace,
  removeMemberFromWorkspace,
} from "@onescope/services";
import { db, schema } from "@onescope/db";
import { eq } from "drizzle-orm";
import { authorizedWorkspaceProcedure, protectedProcedure } from "../../procedures";
import { createNewWorkspace, addWorkspaceToExistingOrg } from "@/server/services/workspace/workspace";

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
      .query(async ({ ctx }) => {
        return safeHandler(async () => {
          const { workspaceId } = ctx;
          const res = await getWorkspaceById({ workspaceId });
          return ok(res, "Successfully fetched workspace by ID.");
        })
      }),

    listByOrg: protectedProcedure
      .input(z.object({ tenantId: z.string().min(1) }))
      .query(async ({ input, ctx }) => {
        return safeHandler(async () => {
          const { tenantId } = input;
          const userId = ctx.user.id;
          const workspaces = await getWorkspacesForUser({ tenantId, userId });
          return ok(workspaces, "Workspaces fetched successfully.");
        });
      }),

    createInOrg: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2).max(50),
          slug: z.string().min(2).max(50),
          domain: z.string().min(2).max(256),
          country: z.string().min(2),
          region: z.string().nullable().optional(),
          tenantId: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return safeHandler(async () => {
          const { name, slug, domain, country, region, tenantId } = input;
          const userId = ctx.user.id;

          if (!name || !domain || !slug || !country) {
            throw new ValidationError("Please fill all the mandatory fields.");
          }

          const res = await addWorkspaceToExistingOrg({
            name, slug, domain, country, region, userId, tenantId,
          });

          return ok(res, "Workspace created successfully.");
        });
      }),

    listMembers: authorizedWorkspaceProcedure
      .query(async ({ ctx }) => {
        return safeHandler(async () => {
          const { workspaceId } = ctx;
          const members = await getWorkspaceMembersWithUsers({ workspaceId });
          return ok(members, "Workspace members fetched successfully.");
        });
      }),

    addMember: authorizedWorkspaceProcedure
      .input(z.object({
        email: z.string().email(),
        role: z.enum(["owner", "member"]).default("member"),
      }))
      .mutation(async ({ input, ctx }) => {
        return safeHandler(async () => {
          const { workspaceId } = ctx;
          const { email, role } = input;

          // Look up user by email
          const targetUser = await db.query.user.findFirst({
            where: eq(schema.user.email, email),
          });

          if (!targetUser) {
            throw new NotFoundError("No user found with that email address. They must sign up first.");
          }

          // Verify they are an org member (get workspace to find tenantId)
          const workspace = await getWorkspaceById({ workspaceId });
          const orgMembership = await db.query.member.findFirst({
            where: (m, { eq, and }) =>
              and(
                eq(m.organizationId, workspace.tenantId),
                eq(m.userId, targetUser.id)
              ),
          });

          if (!orgMembership) {
            throw new ValidationError(
              "User must be an organization member before being added to a workspace."
            );
          }

          const res = await addMemberToWorkspace({
            workspaceId,
            userId: targetUser.id,
            role,
          });

          return ok(res, "Member added to workspace successfully.");
        });
      }),

    removeMember: authorizedWorkspaceProcedure
      .input(z.object({
        userId: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        return safeHandler(async () => {
          const { workspaceId } = ctx;
          const { userId } = input;

          const res = await removeMemberFromWorkspace({ workspaceId, userId });
          return ok(res, "Member removed from workspace successfully.");
        });
      }),
  });
