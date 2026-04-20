import { db, schema } from "@oneglanse/db";
import type { Workspace } from "@oneglanse/db";
import { ValidationError } from "@oneglanse/errors";
import type { CreateWorkspaceForTenantArgs } from "@oneglanse/types";
import { newId } from "@oneglanse/utils";
import { and, eq, isNull } from "drizzle-orm";

export async function createWorkspaceForTenant(
	args: CreateWorkspaceForTenantArgs,
): Promise<Workspace> {
	const { name, slug, domain, tenantId, userId } = args;

	const workspace: Workspace = {
		id: newId("workspace"),
		name,
		slug,
		domain,
		tenantId,
		schedule: null,
		enabledProviders: null,
		selectedPromptIds: null,
		createdAt: new Date(),
		deletedAt: null,
	};

	await db.insert(schema.workspaces).values(workspace);

	await db.insert(schema.workspaceMembers).values({
		workspaceId: workspace.id,
		userId,
		role: "owner",
	});

	return workspace;
}

export async function addWorkspaceToExistingOrg(args: {
	name: string;
	slug: string;
	domain: string;
	userId: string;
	tenantId: string;
}): Promise<{ workspace: Workspace }> {
	const { name, slug, domain, userId, tenantId } = args;

	const membership = await db.query.member.findFirst({
		where: (m, { eq, and }) =>
			and(eq(m.organizationId, tenantId), eq(m.userId, userId)),
	});

	if (!membership) {
		throw new ValidationError("User is not a member of this organization.");
	}

	const workspace = await createWorkspaceForTenant({
		name,
		slug,
		domain,
		tenantId,
		userId,
	});

	return { workspace };
}

/**
 * Returns true if the given user already owns a workspace with this slug.
 * Used to prevent the same user from creating duplicate brand workspaces,
 * while allowing different users to track the same brand freely.
 */
export async function checkSlugExistsForUser(args: {
	userId: string;
	slug: string;
}): Promise<boolean> {
	const { userId, slug } = args;
	const existing = await db
		.select({ id: schema.workspaces.id })
		.from(schema.workspaces)
		.innerJoin(
			schema.workspaceMembers,
			and(
				eq(schema.workspaceMembers.workspaceId, schema.workspaces.id),
				eq(schema.workspaceMembers.userId, userId),
				isNull(schema.workspaceMembers.deletedAt),
			),
		)
		.where(
			and(
				eq(schema.workspaces.slug, slug),
				isNull(schema.workspaces.deletedAt),
			),
		)
		.limit(1)
		.execute();
	return existing.length > 0;
}

export async function checkIsFirstWorkspace(args: {
	userId: string;
}): Promise<boolean> {
	const { userId } = args;
	const existing = await db.query.workspaceMembers.findFirst({
		where: (wm, { eq, and, isNull }) =>
			and(eq(wm.userId, userId), isNull(wm.deletedAt)),
	});
	return !existing;
}
