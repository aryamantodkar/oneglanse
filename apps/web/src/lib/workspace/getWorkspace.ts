import { auth } from "@lib/auth/auth";
import { db } from "@oneglanse/db";
import type { Workspace } from "@oneglanse/db";
import { NotFoundError } from "@oneglanse/errors";
import { headers } from "next/headers";

export async function getWorkspace(): Promise<Workspace | null> {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) return null;

	const sessionWithOrg = session.session as typeof session.session & {
		activeOrganizationId?: string | null;
	};

	const orgId = sessionWithOrg.activeOrganizationId ?? null;

	if (orgId) {
		const workspace = await db.query.workspaces.findFirst({
			where: (table, { and, eq, isNull }) =>
				and(eq(table.tenantId, orgId), isNull(table.deletedAt)),
			orderBy: (table, { desc }) => [desc(table.createdAt)],
		});

		if (workspace) return workspace;
	}

	const membership = await db.query.workspaceMembers.findFirst({
		where: (wm, { and, eq, isNull }) =>
			and(eq(wm.userId, session.user.id), isNull(wm.deletedAt)),
		orderBy: (wm, { desc }) => [desc(wm.createdAt)],
	});

	if (!membership) {
		throw new NotFoundError("No active workspace membership", {
			userId: session.user.id,
		});
	}

	const workspace = await db.query.workspaces.findFirst({
		where: (table, { and, eq, isNull }) =>
			and(eq(table.id, membership.workspaceId), isNull(table.deletedAt)),
	});

	if (!workspace) {
		throw new NotFoundError("No active workspace", {
			workspaceId: membership.workspaceId,
			userId: session.user.id,
		});
	}

	return workspace;
}
