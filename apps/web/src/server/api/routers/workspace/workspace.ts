import "server-only";

import { z } from "zod";
import { randomUUID } from "crypto";
import { createTRPCRouter } from "@/server/api/trpc";
import { safeHandler, ok, ValidationError, NotFoundError } from "@onescope/errors";
import {
  getWorkspaceById,
  getWorkspacesForUser,
  getWorkspaceMembersWithUsers,
  addMemberToWorkspace,
  removeMemberFromWorkspace,
  scheduleCronForPrompts,
  unscheduleCronForPrompts,
  fetchUserPromptsForWorkspace,
  agentQueue,
  redis,
} from "@onescope/services";
import { db, schema } from "@onescope/db";
import { and, eq, isNull, or } from "drizzle-orm";
import { authorizedWorkspaceProcedure, protectedProcedure } from "../../procedures";
import { createNewWorkspace, addWorkspaceToExistingOrg } from "@/server/services/workspace/workspace";
import { newId } from "@onescope/utils";
import { formatWorkspaceJoinCode, parseWorkspaceJoinCode } from "@/lib/workspace/joinCode";

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

    getJoinInfo: authorizedWorkspaceProcedure
      .query(async ({ ctx }) => {
        return safeHandler(async () => {
          const { workspaceId } = ctx;
          const workspace = await getWorkspaceById({ workspaceId });

          const organization = await db.query.organization.findFirst({
            where: eq(schema.organization.id, workspace.tenantId),
          });

          if (!organization) {
            throw new NotFoundError("Organization not found for this workspace.");
          }

          const orgCode = organization.slug ?? organization.id;
          const workspaceCode = formatWorkspaceJoinCode(orgCode, workspace.slug);

          return ok(
            {
              orgCode,
              workspaceCode,
              organization: {
                id: organization.id,
                name: organization.name,
                slug: organization.slug,
              },
              workspace: {
                id: workspace.id,
                name: workspace.name,
                slug: workspace.slug,
              },
            },
            "Workspace join info fetched successfully."
          );
        });
      }),

    addMember: authorizedWorkspaceProcedure
      .input(z.object({
        email: z.string().email(),
        role: z.enum(["owner", "member"]).default("member"),
      }))
      .mutation(async ({ input, ctx }) => {
        return safeHandler(async (): Promise<any> => {
          const { workspaceId } = ctx;
          const { email, role } = input;

          const workspace = await getWorkspaceById({ workspaceId });

          // Look up user by email
          const targetUser = await db.query.user.findFirst({
            where: eq(schema.user.email, email),
          });

          if (!targetUser) {
            const inviteRes = await ctx.auth.api.createInvitation({
              headers: ctx.headers,
              body: {
                email,
                role: "member",
                organizationId: workspace.tenantId,
              },
            });

            return ok(
              { status: "invited", invitation: inviteRes },
              "Invitation sent to organization."
            );
          }

          const orgMembership = await db.query.member.findFirst({
            where: (m, { eq, and }) =>
              and(
                eq(m.organizationId, workspace.tenantId),
                eq(m.userId, targetUser.id)
              ),
          });

          if (!orgMembership) {
            await db.insert(schema.member).values({
              id: newId("member"),
              organizationId: workspace.tenantId,
              userId: targetUser.id,
              role: "member",
              createdAt: new Date(),
            });
          }

          const existingWsMember = await db.query.workspaceMembers.findFirst({
            where: (wm, { eq, and, isNull }) =>
              and(
                eq(wm.workspaceId, workspaceId),
                eq(wm.userId, targetUser.id),
                isNull(wm.deletedAt)
              ),
          });

          if (existingWsMember) {
            return ok(
              { status: "already-member", workspaceId, userId: targetUser.id },
              "User is already a member of this workspace."
            );
          }

          const res = await addMemberToWorkspace({
            workspaceId,
            userId: targetUser.id,
            role,
          });

          return ok(
            { status: "added", ...res },
            "Member added to workspace successfully."
          );
        });
      }),

    joinByCode: protectedProcedure
      .input(
        z.object({
          code: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return safeHandler(async (): Promise<any> => {
          const rawCode = input.code.trim();
          const userId = ctx.user.id;

          let organization = null as { id: string; name: string; slug: string | null } | null;
          let workspace = null as { id: string; name: string; slug: string } | null;

          if (rawCode.startsWith("workspace_")) {
            const workspaceRecord = await db.query.workspaces.findFirst({
              where: (ws, { and, eq, isNull }) =>
                and(eq(ws.id, rawCode), isNull(ws.deletedAt)),
            });

            if (!workspaceRecord) {
              throw new NotFoundError("Workspace not found for this code.");
            }

            const orgRecord = await db.query.organization.findFirst({
              where: eq(schema.organization.id, workspaceRecord.tenantId),
            });

            if (!orgRecord) {
              throw new NotFoundError("Organization not found for this workspace.");
            }

            organization = {
              id: orgRecord.id,
              name: orgRecord.name,
              slug: orgRecord.slug,
            };
            workspace = {
              id: workspaceRecord.id,
              name: workspaceRecord.name,
              slug: workspaceRecord.slug,
            };
          } else {
            const parsed = parseWorkspaceJoinCode(rawCode);
            if (parsed) {
              const orgRecord = await db.query.organization.findFirst({
                where: (org, { eq, or }) =>
                  or(eq(org.slug, parsed.orgCode), eq(org.id, parsed.orgCode)),
              });

              if (!orgRecord) {
                throw new NotFoundError("Organization not found for this code.");
              }

              const workspaceRecord = await db.query.workspaces.findFirst({
                where: (ws, { and, eq, isNull, or }) =>
                  and(
                    eq(ws.tenantId, orgRecord.id),
                    isNull(ws.deletedAt),
                    or(eq(ws.slug, parsed.workspaceCode), eq(ws.id, parsed.workspaceCode))
                  ),
              });

              if (!workspaceRecord) {
                throw new NotFoundError("Workspace not found for this code.");
              }

              organization = {
                id: orgRecord.id,
                name: orgRecord.name,
                slug: orgRecord.slug,
              };
              workspace = {
                id: workspaceRecord.id,
                name: workspaceRecord.name,
                slug: workspaceRecord.slug,
              };
            } else {
              const orgRecord = await db.query.organization.findFirst({
                where: (org, { eq, or }) =>
                  or(eq(org.slug, rawCode), eq(org.id, rawCode)),
              });

              if (!orgRecord) {
                throw new NotFoundError("Organization not found for this code.");
              }

              const orgWorkspaces = await db
                .select({
                  id: schema.workspaces.id,
                  name: schema.workspaces.name,
                  slug: schema.workspaces.slug,
                })
                .from(schema.workspaces)
                .where(
                  and(
                    eq(schema.workspaces.tenantId, orgRecord.id),
                    isNull(schema.workspaces.deletedAt)
                  )
                )
                .execute();

              if (orgWorkspaces.length === 0) {
                throw new NotFoundError("No workspaces found for this organization.");
              }

              if (orgWorkspaces.length > 1) {
                return ok(
                  {
                    status: "select-workspace",
                    organization: {
                      id: orgRecord.id,
                      name: orgRecord.name,
                      slug: orgRecord.slug,
                    },
                    workspaces: orgWorkspaces,
                  },
                  "Select a workspace to join."
                );
              }

              const onlyWorkspace = orgWorkspaces[0]!;
              const workspaceRecord = await db.query.workspaces.findFirst({
                where: (ws, { and, eq, isNull }) =>
                  and(eq(ws.id, onlyWorkspace.id), isNull(ws.deletedAt)),
              });

              if (!workspaceRecord) {
                throw new NotFoundError("Workspace not found for this code.");
              }

              organization = {
                id: orgRecord.id,
                name: orgRecord.name,
                slug: orgRecord.slug,
              };
              workspace = {
                id: workspaceRecord.id,
                name: workspaceRecord.name,
                slug: workspaceRecord.slug,
              };
            }
          }

          if (!organization || !workspace) {
            throw new NotFoundError("Invalid workspace code.");
          }

          const orgMembership = await db.query.member.findFirst({
            where: (m, { eq, and }) =>
              and(eq(m.organizationId, organization.id), eq(m.userId, userId)),
          });

          if (!orgMembership) {
            await db.insert(schema.member).values({
              id: newId("member"),
              organizationId: organization.id,
              userId,
              role: "member",
              createdAt: new Date(),
            });
          }

          const existingWsMember = await db.query.workspaceMembers.findFirst({
            where: (wm, { eq, and, isNull }) =>
              and(
                eq(wm.workspaceId, workspace.id),
                eq(wm.userId, userId),
                isNull(wm.deletedAt)
              ),
          });

          if (!existingWsMember) {
            await addMemberToWorkspace({
              workspaceId: workspace.id,
              userId,
              role: "member",
            });
          }

          return ok(
            {
              status: "joined",
              organization,
              workspace,
            },
            "Workspace joined successfully."
          );
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

    getSchedule: authorizedWorkspaceProcedure
      .query(async ({ ctx }) => {
        return safeHandler(async () => {
          const { workspaceId } = ctx;
          const workspace = await getWorkspaceById({ workspaceId });
          return ok({ schedule: workspace.schedule ?? null }, "Schedule fetched successfully.");
        });
      }),

    setSchedule: authorizedWorkspaceProcedure
      .input(z.object({
        schedule: z.string().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        return safeHandler(async () => {
          const { workspaceId } = ctx;
          const userId = ctx.user.id;
          const { schedule } = input;

          // Update workspace schedule in DB
          await db
            .update(schema.workspaces)
            .set({ schedule })
            .where(eq(schema.workspaces.id, workspaceId));

          // Manage pg_cron job
          if (schedule) {
            await scheduleCronForPrompts({
              workspaceId,
              userId,
              cronExpression: schedule,
            });

            // Trigger immediate first run (with 1-hour cooldown)
            const cooldownKey = `workspace:${workspaceId}:run-cooldown`;
            const canRun = await redis.set(cooldownKey, "1", "EX", 3600, "NX");

            if (canRun) try {
              const prompts = await fetchUserPromptsForWorkspace({ workspaceId, userId });
              if (prompts && prompts.length > 0) {
                const jobGroupId = randomUUID();
                const createdAt = prompts[0]?.created_at ?? new Date().toISOString();
                const providers = ["openai", "anthropic", "perplexity"] as const;

                const progress = {
                  status: "pending" as const,
                  updateId: 0,
                  providers: { openai: "pending", anthropic: "pending", perplexity: "pending" } as Record<string, string>,
                  results: { openai: 0, anthropic: 0, perplexity: 0 } as Record<string, number>,
                  stats: { totalPrompts: prompts.length, expectedResponses: prompts.length * 3, actualResponses: 0 },
                };

                await redis.set(`job:${jobGroupId}:result`, JSON.stringify(progress), "EX", 60 * 60);

                await Promise.all(
                  providers.map((provider) =>
                    agentQueue.add("run-agent", {
                      jobGroupId,
                      provider,
                      prompts,
                      user_id: userId,
                      workspace_id: workspaceId,
                      created_at: createdAt,
                    })
                  )
                );
              }
            } catch (err: any) {
              console.error("Failed to trigger immediate run:", err);
            }
          } else {
            await unscheduleCronForPrompts({ workspaceId });
          }

          return ok({ schedule }, "Schedule updated successfully.");
        });
      }),
  });
