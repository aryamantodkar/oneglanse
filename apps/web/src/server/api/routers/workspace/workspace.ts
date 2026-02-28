import "server-only";

import { randomUUID } from "crypto";
import {
	formatWorkspaceJoinCode,
	parseWorkspaceJoinCode,
} from "@/lib/workspace/joinCode";
import { createTRPCRouter } from "@/server/api/trpc";
import {
	addWorkspaceToExistingOrg,
	createNewWorkspace,
} from "@/server/services/workspace/workspace";
import { clickhouse, db, schema } from "@oneglanse/db";
import { AuthError, NotFoundError, ValidationError } from "@oneglanse/errors";
import {
	addMemberToWorkspace,
	agentQueue,
	fetchUserPromptsForWorkspace,
	getAllWorkspacesForUser,
	getWorkspaceById,
	getWorkspaceMembersWithUsers,
	getWorkspacesForUser,
	redis,
	removeMemberFromWorkspace,
	scheduleCronForPrompts,
	unscheduleCronForPrompts,
} from "@oneglanse/services";
import { PROVIDER_LIST, type Provider } from "@oneglanse/types";
import { ALL_PROVIDERS_JSON, newId } from "@oneglanse/utils";
import { CronExpressionParser } from "cron-parser";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
	authorizedWorkspaceProcedure,
	protectedProcedure,
} from "../../procedures";

function parseCronExpressionOrThrow(cronExpression: string) {
	try {
		return CronExpressionParser.parse(cronExpression, {
			currentDate: new Date(),
		});
	} catch (err) {
		throw new ValidationError("Invalid cron expression", {
			cronExpression,
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

export const workspaceRouter = createTRPCRouter({
	create: protectedProcedure
		.input(
			z.object({
				organizationName: z.string().min(2).max(80).optional(),
				name: z.string().min(2).max(50),
				slug: z.string().min(2).max(50),
				domain: z.string().min(2).max(50),
				country: z.string().min(2),
				region: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const {
				user: { id: userId },
				headers,
			} = ctx;

			const { organizationName, name, slug, domain, country, region } = input;

			if (!name || !domain || !slug || !country) {
				throw new ValidationError("Please fill all the mandatory fields.");
			}

			const existingMembership = await db.query.workspaceMembers.findFirst({
				where: and(
					eq(schema.workspaceMembers.userId, userId),
					isNull(schema.workspaceMembers.deletedAt),
				),
			});
			const isFirstWorkspace = !existingMembership;

			const res = await createNewWorkspace({
				organizationName,
				name,
				slug,
				domain,
				country,
				region,
				userId,
				headers,
			});

			return { ...res, isFirstWorkspace };
		}),

	getById: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		const { workspaceId } = ctx;
		return getWorkspaceById({ workspaceId });
	}),

	listByOrg: protectedProcedure
		.input(z.object({ tenantId: z.string().min(1) }))
		.query(async ({ input, ctx }) => {
			const { tenantId } = input;
			const userId = ctx.user.id;
			return getWorkspacesForUser({ tenantId, userId });
		}),

	listAllForUser: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.user.id;
		return getAllWorkspacesForUser({ userId });
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
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { name, slug, domain, country, region, tenantId } = input;
			const userId = ctx.user.id;

			if (!name || !domain || !slug || !country) {
				throw new ValidationError("Please fill all the mandatory fields.");
			}

			const existingMembership = await db.query.workspaceMembers.findFirst({
				where: and(
					eq(schema.workspaceMembers.userId, userId),
					isNull(schema.workspaceMembers.deletedAt),
				),
			});
			const isFirstWorkspace = !existingMembership;

			const res = await addWorkspaceToExistingOrg({
				name,
				slug,
				domain,
				country,
				region,
				userId,
				tenantId,
			});

			return { ...res, isFirstWorkspace };
		}),

	listMembers: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		const { workspaceId } = ctx;
		return getWorkspaceMembersWithUsers({ workspaceId });
	}),

	updateDetails: authorizedWorkspaceProcedure
		.input(
			z.object({
				workspaceId: z.string().min(1),
				name: z.string().min(2).max(80),
				domain: z.string().min(2).max(256),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (ctx.membership.role !== "owner") {
				throw new ValidationError(
					"Only workspace owners can update workspace details.",
				);
			}

			const { workspaceId, name, domain } = input;
			const nextName = name.trim();
			const nextDomain = domain.trim();

			const current = await getWorkspaceById({ workspaceId });
			const brandChanged =
				current.name.trim() !== nextName ||
				current.domain.trim() !== nextDomain;

			await db
				.update(schema.workspaces)
				.set({
					name: nextName,
					domain: nextDomain,
				})
				.where(
					and(
						eq(schema.workspaces.id, workspaceId),
						isNull(schema.workspaces.deletedAt),
					),
				);

			// Brand identity changed: clear derived analysis only, keep raw prompt responses intact.
			if (brandChanged) {
				await clickhouse.command({
					query: `
              ALTER TABLE analytics.prompt_analysis
              DELETE WHERE workspace_id = {workspaceId:String}
            `,
					query_params: { workspaceId },
				});

				await clickhouse.command({
					query: `
              ALTER TABLE analytics.prompt_responses
              UPDATE is_analysed = false
              WHERE workspace_id = {workspaceId:String}
            `,
					query_params: { workspaceId },
				});
			}

			const workspace = await getWorkspaceById({ workspaceId });
			return { workspace, analysisReset: brandChanged };
		}),

	updateOrganizationName: authorizedWorkspaceProcedure
		.input(
			z.object({
				workspaceId: z.string().min(1),
				organizationName: z.string().min(2).max(80),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			if (ctx.membership.role !== "owner") {
				throw new ValidationError(
					"Only workspace owners can rename the organization.",
				);
			}

			const workspace = await getWorkspaceById({
				workspaceId: input.workspaceId,
			});
			const baseSlug =
				input.organizationName
					.trim()
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.replace(/^-+|-+$/g, "")
					.slice(0, 64) || "organization";

			let nextSlug = baseSlug;
			let attempt = 1;
			while (true) {
				const existing = await db.query.organization.findFirst({
					where: eq(schema.organization.slug, nextSlug),
				});

				if (!existing || existing.id === workspace.tenantId) break;
				attempt += 1;
				nextSlug = `${baseSlug}-${attempt}`;
			}

			await db
				.update(schema.organization)
				.set({
					name: input.organizationName.trim(),
					slug: nextSlug,
				})
				.where(eq(schema.organization.id, workspace.tenantId));

			return db.query.organization.findFirst({
				where: eq(schema.organization.id, workspace.tenantId),
			});
		}),

	getJoinInfo: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
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

		return {
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
		};
	}),

	addMember: authorizedWorkspaceProcedure
		.input(
			z.object({
				email: z.string().email(),
				role: z.enum(["owner", "member"]).default("member"),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const { workspaceId } = ctx;
			const { email, role } = input;

			const workspace = await getWorkspaceById({ workspaceId });

			// Look up user by email
			const targetUser = await db.query.user.findFirst({
				where: eq(schema.user.email, email),
			});

			if (!targetUser) {
				return { status: "not-found" as const };
			}

			const orgMembership = await db.query.member.findFirst({
				where: (m, { eq, and }) =>
					and(
						eq(m.organizationId, workspace.tenantId),
						eq(m.userId, targetUser.id),
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
						isNull(wm.deletedAt),
					),
			});

			if (existingWsMember) {
				return {
					status: "already-member" as const,
					workspaceId,
					userId: targetUser.id,
				};
			}

			const res = await addMemberToWorkspace({
				workspaceId,
				userId: targetUser.id,
				role,
			});

			return { status: "added" as const, ...res };
		}),

	joinByCode: protectedProcedure
		.input(
			z.object({
				code: z.string().min(1),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			const rawCode = input.code.trim();
			const userId = ctx.user.id;

			let organization = null as {
				id: string;
				name: string;
				slug: string | null;
			} | null;
			let workspace = null as {
				id: string;
				name: string;
				slug: string;
			} | null;

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
					throw new NotFoundError(
						"Organization not found for this workspace.",
					);
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
								or(
									eq(ws.slug, parsed.workspaceCode),
									eq(ws.id, parsed.workspaceCode),
								),
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
								isNull(schema.workspaces.deletedAt),
							),
						)
						.execute();

					if (orgWorkspaces.length === 0) {
						throw new NotFoundError(
							"No workspaces found for this organization.",
						);
					}

					if (orgWorkspaces.length > 1) {
						return {
							status: "select-workspace" as const,
							organization: {
								id: orgRecord.id,
								name: orgRecord.name,
								slug: orgRecord.slug,
							},
							workspaces: orgWorkspaces,
						};
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
						isNull(wm.deletedAt),
					),
			});

			if (!existingWsMember) {
				await addMemberToWorkspace({
					workspaceId: workspace.id,
					userId,
					role: "member",
				});
			}

			return {
				status: "joined" as const,
				organization,
				workspace,
			};
		}),

	removeMember: authorizedWorkspaceProcedure
		.input(z.object({ userId: z.string().min(1), role: z.string().min(1) }))
		.mutation(async ({ input, ctx }) => {
			const { workspaceId, user } = ctx;
			const { userId, role } = input;

			if (role !== "owner") {
				throw new AuthError("Only workspace owners can remove members.");
			}
			if (userId === user.id) {
				throw new ValidationError("You cannot remove yourself.");
			}

			return removeMemberFromWorkspace({ workspaceId, userId });
		}),

	getSchedule: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		const { workspaceId } = ctx;
		const workspace = await getWorkspaceById({ workspaceId });
		return { schedule: workspace.schedule ?? null };
	}),

	getEnabledProviders: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		const { workspaceId } = ctx;
		const workspace = await getWorkspaceById({ workspaceId });

		const enabledProviders = workspace.enabledProviders
			? JSON.parse(workspace.enabledProviders)
			: [...PROVIDER_LIST];

		return { enabledProviders };
	}),

	setEnabledProviders: authorizedWorkspaceProcedure
		.input(
			z.object({
				providers: z
					.array(
						z.enum([...PROVIDER_LIST] as [Provider, ...Provider[]]),
					)
					.min(1, "At least one provider must be enabled"),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const { workspaceId } = ctx;
			const { providers } = input;

			await db
				.update(schema.workspaces)
				.set({ enabledProviders: JSON.stringify(providers) })
				.where(eq(schema.workspaces.id, workspaceId));

			return { providers };
		}),

	setSchedule: authorizedWorkspaceProcedure
		.input(
			z.object({
				schedule: z.string().nullable(),
			}),
		)
			.mutation(async ({ ctx, input }) => {
				const { workspaceId } = ctx;
				const userId = ctx.user.id;
				const { schedule } = input;

				if (schedule) {
					parseCronExpressionOrThrow(schedule);
				}

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

				// Trigger immediate first run.
				// const cooldownKey = `workspace:${workspaceId}:run-cooldown`;
				// const canRun = await redis.set(cooldownKey, "1", "EX", 3600, "NX");

				// Instantly run prompts
				const canRun = "OK";

				if (canRun)
					try {
						const prompts = await fetchUserPromptsForWorkspace({
							workspaceId,
							userId,
						});
						if (prompts && prompts.length > 0) {
							const jobGroupId = randomUUID();

							// Fetch workspace and parse enabled providers
							const workspace = await getWorkspaceById({ workspaceId });
							const enabledProvidersJson =
								workspace.enabledProviders ?? ALL_PROVIDERS_JSON;
							const enabledProviders = JSON.parse(
								enabledProvidersJson,
							) as Provider[];

							const progress = {
								status: "pending" as const,
								updateId: 0,
								providers: Object.fromEntries(
									enabledProviders.map((p) => [p, "pending"]),
								) as Record<string, string>,
								results: Object.fromEntries(
									enabledProviders.map((p) => [p, 0]),
								) as Record<string, number>,
								stats: {
									totalPrompts: prompts.length,
									expectedResponses: prompts.length * enabledProviders.length,
									actualResponses: 0,
								},
							};

							await redis.set(
								`job:${jobGroupId}:result`,
								JSON.stringify(progress),
								"EX",
								60 * 60,
							);

							await Promise.all(
								enabledProviders.map((provider) =>
									agentQueue.add("run-agent", {
										jobGroupId,
										provider,
										prompts,
										user_id: userId,
										workspace_id: workspaceId,
									}),
								),
							);
						}
					} catch (err) {
						console.error("Failed to trigger immediate run:", err);
					}
			} else {
				await unscheduleCronForPrompts({ workspaceId });
			}

			return { schedule };
		}),

	getCronTiming: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		const { workspaceId } = ctx;

		// Get the workspace to find the schedule
		const workspace = await getWorkspaceById({ workspaceId });
		const cronSchedule = workspace.schedule;

				let nextRun = null;
				if (cronSchedule) {
					try {
						// Parse and validate cron with library support instead of manual split/parse.
						const expression = parseCronExpressionOrThrow(cronSchedule);
						nextRun = expression.next().toDate().toISOString();
					} catch (err) {
						console.error("Error calculating next run:", err);
					}
				}

		// Get last prompt run time (manual or scheduled) from ClickHouse
		let lastPromptRun = null;
		try {
			const promptRunResult = await clickhouse.query({
				query: `
              SELECT toUnixTimestamp(MAX(prompt_run_at)) as last_run_ts
              FROM analytics.prompt_responses
              WHERE workspace_id = {workspaceId:String}
            `,
				query_params: { workspaceId },
				format: "JSONEachRow",
			});

			const data = (await promptRunResult.json()) as Array<{
				last_run_ts: number;
			}>;
			if (
				data.length > 0 &&
				data[0]?.last_run_ts &&
				data[0].last_run_ts > 0
			) {
				// Convert Unix timestamp (seconds) to ISO string
				lastPromptRun = new Date(data[0].last_run_ts * 1000).toISOString();
			}
		} catch (err) {
			console.error("Error fetching last prompt run:", err);
		}

		return { nextRun, lastPromptRun };
	}),
});
