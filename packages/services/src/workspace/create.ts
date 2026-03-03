import { db, schema } from "@oneglanse/db";
import type { Workspace } from "@oneglanse/db";
import { ValidationError } from "@oneglanse/errors";
import type { CreateWorkspaceForTenantArgs } from "@oneglanse/types";
import { ALL_PROVIDERS_JSON, newId } from "@oneglanse/utils";

export async function createWorkspaceForTenant(
	args: CreateWorkspaceForTenantArgs,
): Promise<Workspace> {
	const { name, slug, domain, tenantId, country, region, userId } = args;

	const workspace: Workspace = {
		id: newId("workspace"),
		name,
		slug,
		domain,
		tenantId,
		country,
		region: region || null,
		schedule: null,
		enabledProviders: ALL_PROVIDERS_JSON,
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
	country: string;
	region?: string | null;
	userId: string;
	tenantId: string;
}): Promise<{ workspace: Workspace }> {
	const { name, slug, domain, country, region, userId, tenantId } = args;

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
		country,
		region,
		userId,
	});

	return { workspace };
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
