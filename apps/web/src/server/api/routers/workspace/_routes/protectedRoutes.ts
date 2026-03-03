import { auth } from "@/lib/auth/auth";
import { ValidationError } from "@oneglanse/errors";
import {
	addWorkspaceToExistingOrg,
	checkIsFirstWorkspace,
	createWorkspaceForTenant,
	deleteUserAccount,
	getAllWorkspacesForUser,
	getWorkspacesForUser,
	joinWorkspaceByCode,
} from "@oneglanse/services";
import { createRateLimiter } from "../../../middleware/rateLimit";
import { protectedProcedure } from "../../../procedures";
import {
	createInOrgInputSchema,
	createWorkspaceInputSchema,
	joinByCodeInputSchema,
	listByOrgInputSchema,
} from "../_schemas";

export const protectedWorkspaceRoutes = {
	create: protectedProcedure
		.input(createWorkspaceInputSchema)
		.use(createRateLimiter("workspace.create", { limit: 3, windowSecs: 3600 }))
		.mutation(async ({ input, ctx }) => {
			const {
				user: { id: userId },
				headers,
			} = ctx;
			const { organizationName, name, slug, domain } = input;

			if (!name || !domain || !slug) {
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
				userId,
			});

			return { workspace, org, isFirstWorkspace };
		}),

	listByOrg: protectedProcedure
		.input(listByOrgInputSchema)
		.query(async ({ input, ctx }) => {
			return getWorkspacesForUser({
				tenantId: input.tenantId,
				userId: ctx.user.id,
			});
		}),

	listAllForUser: protectedProcedure.query(async ({ ctx }) => {
		return getAllWorkspacesForUser({ userId: ctx.user.id });
	}),

	createInOrg: protectedProcedure
		.input(createInOrgInputSchema)
		.mutation(async ({ input, ctx }) => {
			const { name, slug, domain, tenantId } = input;
			const userId = ctx.user.id;

			if (!name || !domain || !slug) {
				throw new ValidationError("Please fill all the mandatory fields.");
			}

			const isFirstWorkspace = await checkIsFirstWorkspace({ userId });
			const res = await addWorkspaceToExistingOrg({
				name,
				slug,
				domain,
				userId,
				tenantId,
			});

			return { ...res, isFirstWorkspace };
		}),

	joinByCode: protectedProcedure
		.input(joinByCodeInputSchema)
		.use(
			createRateLimiter("workspace.joinByCode", { limit: 5, windowSecs: 900 }),
		)
		.mutation(async ({ input, ctx }) => {
			return joinWorkspaceByCode({ code: input.code, userId: ctx.user.id });
		}),

	deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
		await deleteUserAccount({ userId: ctx.user.id });
	}),
};
