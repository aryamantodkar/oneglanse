import { AuthError, ValidationError } from "@oneglanse/errors";
import {
	addMemberToWorkspaceByEmail,
	getLastPromptRunTime,
	getWorkspaceById,
	getWorkspaceJoinInfo,
	getWorkspaceMembersWithUsers,
	removeMemberFromWorkspace,
	setWorkspaceEnabledProviders,
	updateOrganizationName,
	updateWorkspaceDetails,
	updateWorkspaceSchedule,
} from "@oneglanse/services";
import { PROVIDER_LIST } from "@oneglanse/types";
import { authorizedWorkspaceProcedure } from "../../../procedures";
import {
	parseCronExpressionOrThrow,
	submitImmediateRunWithRetry,
} from "../_helpers/scheduling";
import {
	addMemberInputSchema,
	removeMemberInputSchema,
	setEnabledProvidersInputSchema,
	setScheduleInputSchema,
	updateDetailsInputSchema,
	updateOrganizationNameInputSchema,
} from "../_schemas";

export const authorizedWorkspaceRoutes = {
	getById: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		return getWorkspaceById({ workspaceId: ctx.workspaceId });
	}),

	listMembers: authorizedWorkspaceProcedure.query(async ({ ctx }) => {
		return getWorkspaceMembersWithUsers({ workspaceId: ctx.workspaceId });
	}),

	updateDetails: authorizedWorkspaceProcedure
		.input(updateDetailsInputSchema)
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
		.input(updateOrganizationNameInputSchema)
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
		.input(addMemberInputSchema)
		.mutation(async ({ input, ctx }) => {
			return addMemberToWorkspaceByEmail({
				workspaceId: ctx.workspaceId,
				email: input.email,
				role: input.role,
			});
		}),

	removeMember: authorizedWorkspaceProcedure
		.input(removeMemberInputSchema)
		.mutation(async ({ input, ctx }) => {
			const { workspaceId, user, membership } = ctx;
			const { userId } = input;

			if (membership.role !== "owner") {
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
		.input(setEnabledProvidersInputSchema)
		.mutation(async ({ ctx, input }) => {
			return setWorkspaceEnabledProviders({
				workspaceId: ctx.workspaceId,
				providers: input.providers,
			});
		}),

	setSchedule: authorizedWorkspaceProcedure
		.input(setScheduleInputSchema)
		.mutation(async ({ ctx, input }) => {
			const { workspaceId } = ctx;
			const userId = ctx.user.id;
			const { schedule } = input;

			if (schedule) {
				parseCronExpressionOrThrow(schedule);
			}

			const result = await updateWorkspaceSchedule({
				workspaceId,
				userId,
				schedule,
			});

			let immediateRun:
				| { status: "not-requested" }
				| { status: "queued"; jobId: string }
				| { status: "empty" }
				| { status: "failed"; error: string } = { status: "not-requested" };

			if (schedule) {
				immediateRun = await submitImmediateRunWithRetry({
					workspaceId,
					userId,
					maxAttempts: 3,
				});
			}

			return { ...result, immediateRun };
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
};
