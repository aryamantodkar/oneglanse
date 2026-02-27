import "server-only";

import { schema } from "@oneglanse/db";
import { AuthError, ValidationError } from "@oneglanse/errors";
import { t } from "../trpc";

export const validWorkspace = t.middleware(async ({ ctx, input, next }) => {
	const user = ctx.session?.user;

	if (!user) {
		throw new AuthError("User Id is undefined.");
	}

	const parsed = schema.workspaceInput.safeParse(input);

	if (!parsed.success) {
		throw new ValidationError("Workspace ID is missing or undefined.");
	}

	const { workspaceId } = parsed.data;

	const membership = await ctx.db.query.workspaceMembers.findFirst({
		where: (wm, { eq, and, isNull }) =>
			and(
				eq(wm.workspaceId, workspaceId),
				eq(wm.userId, user.id),
				isNull(wm.deletedAt),
			),
	});

	if (!membership) {
		throw new ValidationError("User does not have access to this workspace.");
	}

	return next({
		ctx: {
			...ctx,
			user,
			workspaceId,
			membership,
		},
	});
});
