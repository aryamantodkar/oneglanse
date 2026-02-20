import { db, schema } from "@onescope/db";
import type { Workspace } from "@onescope/db";
import { NotFoundError, ValidationError } from "@onescope/errors";
import { ALL_PROVIDERS_JSON, newId } from "@onescope/utils";
import { and, eq, isNull, sql } from "drizzle-orm";

export async function createWorkspaceForTenant(args: {
	name: string;
	slug: string;
	domain: string;
	tenantId: string;
	country: string;
	region?: string | null;
	userId: string;
}) {
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

export async function getWorkspaceById(args: {
	workspaceId: string;
}) {
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

export async function getWorkspacesForUser(args: {
	tenantId: string;
	userId: string;
}) {
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

export async function getWorkspaceMembersWithUsers(args: {
	workspaceId: string;
}) {
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

export async function addMemberToWorkspace(args: {
	workspaceId: string;
	userId: string;
	role?: string;
}) {
	const { workspaceId, userId, role = "member" } = args;

	// Check if already an active member
	const existing = await db.query.workspaceMembers.findFirst({
		where: (wm, { eq, and, isNull }) =>
			and(
				eq(wm.workspaceId, workspaceId),
				eq(wm.userId, userId),
				isNull(wm.deletedAt),
			),
	});

	if (existing) {
		throw new ValidationError("User is already a member of this workspace.");
	}

	await db.insert(schema.workspaceMembers).values({
		workspaceId,
		userId,
		role,
	});

	return { workspaceId, userId, role };
}

export async function removeMemberFromWorkspace(args: {
	workspaceId: string;
	userId: string;
}) {
	const { workspaceId, userId } = args;

	// Prevent removing the last owner
	const owners = await db
		.select({ id: schema.workspaceMembers.id })
		.from(schema.workspaceMembers)
		.where(
			and(
				eq(schema.workspaceMembers.workspaceId, workspaceId),
				eq(schema.workspaceMembers.role, "owner"),
				isNull(schema.workspaceMembers.deletedAt),
			),
		)
		.execute();

	const memberToRemove = await db.query.workspaceMembers.findFirst({
		where: (wm, { eq, and, isNull }) =>
			and(
				eq(wm.workspaceId, workspaceId),
				eq(wm.userId, userId),
				isNull(wm.deletedAt),
			),
	});

	if (!memberToRemove) {
		throw new NotFoundError("Member not found in this workspace.");
	}

	if (memberToRemove.role === "owner" && owners.length <= 1) {
		throw new ValidationError("Cannot remove the last owner of a workspace.");
	}

	// Soft delete
	await db
		.update(schema.workspaceMembers)
		.set({ deletedAt: new Date() })
		.where(
			and(
				eq(schema.workspaceMembers.workspaceId, workspaceId),
				eq(schema.workspaceMembers.userId, userId),
				isNull(schema.workspaceMembers.deletedAt),
			),
		)
		.execute();

	return { workspaceId, userId };
}

export async function getAllWorkspacesForUser(args: { userId: string }) {
	const { userId } = args;

	// Get all active workspace memberships with workspace + org details in one query
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

	// Group by organization
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
			orgMap.set(orgId, {
				organization: row.organization,
				workspaces: [],
			});
		}
		orgMap.get(orgId)!.workspaces.push(row.workspace);
	}

	return Array.from(orgMap.values());
}
