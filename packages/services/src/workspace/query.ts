import { db, schema } from "@oneglanse/db";
import type { Workspace } from "@oneglanse/db";
import { NotFoundError, ValidationError } from "@oneglanse/errors";
import type {
	GetAllWorkspacesForUserArgs,
	GetWorkspaceByIdArgs,
	GetWorkspaceMembersWithUsersArgs,
	GetWorkspacesForUserArgs,
	WorkspaceJoinInfo,
	WorkspaceMemberWithUser,
} from "@oneglanse/types";
import { and, eq, isNull } from "drizzle-orm";
import type {
	JoinByCodeOrganization,
	JoinByCodeWorkspace,
	OrganizationWorkspaceGroup,
} from "./_internal/types.js";

export async function getWorkspaceById(
	args: GetWorkspaceByIdArgs,
): Promise<Workspace> {
	const { workspaceId } = args;

	if (!workspaceId || workspaceId.trim() === "") {
		throw new ValidationError("Workspace ID is undefined.");
	}

	const [workspace] = await db
		.select()
		.from(schema.workspaces)
		.where(
			and(
				eq(schema.workspaces.id, workspaceId),
				isNull(schema.workspaces.deletedAt),
			),
		)
		.execute();

	if (!workspace) {
		throw new NotFoundError(`Workspace with ID ${workspaceId} not found.`);
	}

	return workspace;
}

export async function getWorkspacesForUser(
	args: GetWorkspacesForUserArgs,
): Promise<Workspace[]> {
	const { tenantId, userId } = args;

	if (!tenantId || tenantId.trim() === "") {
		throw new ValidationError("Tenant ID is undefined.");
	}

	const workspaces = await db
		.select({
			id: schema.workspaces.id,
			name: schema.workspaces.name,
			slug: schema.workspaces.slug,
			domain: schema.workspaces.domain,
			tenantId: schema.workspaces.tenantId,
			country: schema.workspaces.country,
			region: schema.workspaces.region,
			schedule: schema.workspaces.schedule,
			enabledProviders: schema.workspaces.enabledProviders,
			createdAt: schema.workspaces.createdAt,
			deletedAt: schema.workspaces.deletedAt,
		})
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
				eq(schema.workspaces.tenantId, tenantId),
				isNull(schema.workspaces.deletedAt),
			),
		)
		.execute();

	return workspaces;
}

export async function getWorkspaceMembersWithUsers(
	args: GetWorkspaceMembersWithUsersArgs,
): Promise<WorkspaceMemberWithUser[]> {
	const { workspaceId } = args;

	if (!workspaceId || workspaceId.trim() === "") {
		throw new ValidationError("Workspace ID is undefined.");
	}

	const members = await db
		.select({
			memberId: schema.workspaceMembers.id,
			userId: schema.workspaceMembers.userId,
			role: schema.workspaceMembers.role,
			joinedAt: schema.workspaceMembers.createdAt,
			userName: schema.user.name,
			userEmail: schema.user.email,
			userImage: schema.user.image,
		})
		.from(schema.workspaceMembers)
		.innerJoin(schema.user, eq(schema.user.id, schema.workspaceMembers.userId))
		.where(
			and(
				eq(schema.workspaceMembers.workspaceId, workspaceId),
				isNull(schema.workspaceMembers.deletedAt),
			),
		)
		.execute();

	return members;
}

export async function getAllWorkspacesForUser(
	args: GetAllWorkspacesForUserArgs,
): Promise<OrganizationWorkspaceGroup[]> {
	const { userId } = args;

	const rows = await db
		.select({
			workspace: {
				id: schema.workspaces.id,
				name: schema.workspaces.name,
				slug: schema.workspaces.slug,
				domain: schema.workspaces.domain,
				tenantId: schema.workspaces.tenantId,
				country: schema.workspaces.country,
				region: schema.workspaces.region,
				schedule: schema.workspaces.schedule,
				enabledProviders: schema.workspaces.enabledProviders,
				createdAt: schema.workspaces.createdAt,
				deletedAt: schema.workspaces.deletedAt,
			},
			organization: {
				id: schema.organization.id,
				name: schema.organization.name,
				slug: schema.organization.slug,
			},
		})
		.from(schema.workspaceMembers)
		.innerJoin(
			schema.workspaces,
			and(
				eq(schema.workspaces.id, schema.workspaceMembers.workspaceId),
				isNull(schema.workspaces.deletedAt),
			),
		)
		.innerJoin(
			schema.organization,
			eq(schema.organization.id, schema.workspaces.tenantId),
		)
		.where(
			and(
				eq(schema.workspaceMembers.userId, userId),
				isNull(schema.workspaceMembers.deletedAt),
			),
		)
		.execute();

	const orgMap = new Map<
		string,
		{
			organization: { id: string; name: string; slug: string | null };
			workspaces: (typeof rows)[number]["workspace"][];
		}
	>();

	for (const row of rows) {
		const orgId = row.organization.id;
		if (!orgMap.has(orgId)) {
			orgMap.set(orgId, { organization: row.organization, workspaces: [] });
		}
		const orgEntry = orgMap.get(orgId) as {
			organization: { id: string; name: string; slug: string | null };
			workspaces: (typeof rows)[number]["workspace"][];
		};
		orgEntry.workspaces.push(row.workspace);
	}

	return Array.from(orgMap.values());
}

export async function getWorkspaceJoinInfo(args: {
	workspaceId: string;
}): Promise<WorkspaceJoinInfo> {
	const { workspaceId } = args;
	const workspace = await getWorkspaceById({ workspaceId });

	const organization = await db.query.organization.findFirst({
		where: eq(schema.organization.id, workspace.tenantId),
	});

	if (!organization) {
		throw new NotFoundError("Organization not found for this workspace.");
	}

	// Use the workspace UUID as the join code — globally unique, no slug collision across orgs.
	// joinWorkspaceByCode already handles the `workspace_` prefix via its first branch.
	const orgCode = organization.slug ?? organization.id;
	const workspaceCode = workspace.id;

	return {
		orgCode,
		workspaceCode,
		organization: {
			id: organization.id,
			name: organization.name,
			slug: organization.slug,
		},
		workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
	};
}

export type { JoinByCodeOrganization, JoinByCodeWorkspace };
