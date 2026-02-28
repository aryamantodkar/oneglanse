import "server-only";

import { createTRPCRouter } from "@/server/api/trpc";
import { auth } from "@lib/auth/auth";
import { AuthError, ValidationError } from "@oneglanse/errors";
import {
	addWorkspaceToExistingOrg,
	addMemberToWorkspaceByEmail,
	checkIsFirstWorkspace,
	createWorkspaceForTenant,
	getAllWorkspacesForUser,
	getLastPromptRunTime,
	getWorkspaceById,
	getWorkspaceJoinInfo,
	getWorkspaceMembersWithUsers,
	getWorkspacesForUser,
	joinWorkspaceByCode,
	removeMemberFromWorkspace,
	setWorkspaceEnabledProviders,
	submitAgentJobGroup,
	updateOrganizationName,
	updateWorkspaceDetails,
	updateWorkspaceSchedule,
} from "@oneglanse/services";
import { PROVIDER_LIST, type Provider } from "@oneglanse/types";
import { CronExpressionParser } from "cron-parser";
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

			const isFirstWorkspace = await checkIsFirstWorkspace({ userId });
			const org = await auth.api.createOrganization({
				body: {
					name: organizationName?.trim() || name,
					slug,
					keepCurrentActiveOrganization: true,
				},
				headers,
			});

			if (!org?.id) {
				throw new ValidationError("Organization ID is undefined.");
			}

			const workspace = await createWorkspaceForTenant({
				name,
				slug,
				domain,
				tenantId: org.id,
				country,
				region,
				userId,
			});

			return { workspace, org, isFirstWorkspace };
		}),

	getById: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		return getWorkspaceById({ workspaceId: ctx.workspaceId });
	}),

	listByOrg: protectedProcedure
		.input(z.object({ tenantId: z.string().min(1) }))
		.query(async ({ input, ctx }) => {
			return getWorkspacesForUser({ tenantId: input.tenantId, userId: ctx.user.id });
		}),

	listAllForUser: protectedProcedure.query(async ({ ctx }) => {
		return getAllWorkspacesForUser({ userId: ctx.user.id });
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

			const isFirstWorkspace = await checkIsFirstWorkspace({ userId });
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
		return getWorkspaceMembersWithUsers({ workspaceId: ctx.workspaceId });
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
			return updateWorkspaceDetails({
				workspaceId: input.workspaceId,
				name: input.name,
				domain: input.domain,
			});
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
			return updateOrganizationName({
				workspaceId: input.workspaceId,
				organizationName: input.organizationName,
			});
		}),

	getJoinInfo: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		return getWorkspaceJoinInfo({ workspaceId: ctx.workspaceId });
	}),

	addMember: authorizedWorkspaceProcedure
		.input(
			z.object({
				email: z.string().email(),
				role: z.enum(["owner", "member"]).default("member"),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			return addMemberToWorkspaceByEmail({
				workspaceId: ctx.workspaceId,
				email: input.email,
				role: input.role,
			});
		}),

	joinByCode: protectedProcedure
		.input(z.object({ code: z.string().min(1) }))
		.mutation(async ({ input, ctx }) => {
			return joinWorkspaceByCode({ code: input.code, userId: ctx.user.id });
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
		const workspace = await getWorkspaceById({ workspaceId: ctx.workspaceId });
		return { schedule: workspace.schedule ?? null };
	}),

	getEnabledProviders: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		const workspace = await getWorkspaceById({ workspaceId: ctx.workspaceId });
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
			return setWorkspaceEnabledProviders({
				workspaceId: ctx.workspaceId,
				providers: input.providers,
			});
		}),

	setSchedule: authorizedWorkspaceProcedure
		.input(z.object({ schedule: z.string().nullable() }))
		.mutation(async ({ ctx, input }) => {
			const { workspaceId } = ctx;
			const userId = ctx.user.id;
			const { schedule } = input;

			if (schedule) {
				parseCronExpressionOrThrow(schedule);
			}

			const result = await updateWorkspaceSchedule({ workspaceId, userId, schedule });

			if (schedule) {
				try {
					await submitAgentJobGroup({ workspaceId, userId });
				} catch (err) {
					console.error("Failed to trigger immediate run:", err);
				}
			}

			return result;
		}),

	getCronTiming: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		const { workspaceId } = ctx;
		const workspace = await getWorkspaceById({ workspaceId });
		const cronSchedule = workspace.schedule;

		let nextRun = null;
		if (cronSchedule) {
			try {
				const expression = parseCronExpressionOrThrow(cronSchedule);
				nextRun = expression.next().toDate().toISOString();
			} catch (err) {
				console.error("Error calculating next run:", err);
			}
		}

		let lastPromptRun = null;
		try {
			lastPromptRun = await getLastPromptRunTime({ workspaceId });
		} catch (err) {
			console.error("Error fetching last prompt run:", err);
		}

		return { nextRun, lastPromptRun };
	}),

});
