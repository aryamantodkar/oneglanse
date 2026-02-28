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

	const workspace = await ctx.db.query.workspaces.findFirst({
		where: (w, { and, eq, isNull }) =>
			and(eq(w.id, workspaceId), isNull(w.deletedAt)),
	});

	if (!workspace) {
		throw new ValidationError("Workspace not found or deleted.");
	}

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
