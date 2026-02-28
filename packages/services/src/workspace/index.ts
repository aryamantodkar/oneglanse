import { db, schema } from "@oneglanse/db";
import type { Workspace } from "@oneglanse/db";
import { NotFoundError, ValidationError } from "@oneglanse/errors";
import type {
	AddMemberToWorkspaceArgs,
	AddMemberToWorkspaceResult,
	CreateWorkspaceForTenantArgs,
	GetAllWorkspacesForUserArgs,
	GetWorkspaceByIdArgs,
	GetWorkspaceMembersWithUsersArgs,
	GetWorkspacesForUserArgs,
	Provider,
	RemoveMemberFromWorkspaceArgs,
	RemoveMemberFromWorkspaceResult,
} from "@oneglanse/types";
import { formatWorkspaceJoinCode, parseWorkspaceJoinCode } from "@oneglanse/utils";
import { resetWorkspaceAnalysis } from "../analysis/analysis.js";
import { scheduleCronForPrompts, unscheduleCronForPrompts } from "../prompt/index.js";

// JOIN result type — aliased columns from workspaceMembers + user
type WorkspaceMemberWithUser = {
	memberId: string;
	userId: string;
	role: string;
	joinedAt: Date;
	userName: string;
	userEmail: string;
	userImage: string | null;
};

// Grouping type — workspaces scoped to an organization
type OrganizationWorkspaceGroup = {
	organization: { id: string; name: string; slug: string | null };
	workspaces: Workspace[];
};
import { ALL_PROVIDERS_JSON, newId } from "@oneglanse/utils";
import { and, eq, isNull, sql } from "drizzle-orm";

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

export async function addMemberToWorkspace(
	args: AddMemberToWorkspaceArgs,
): Promise<AddMemberToWorkspaceResult> {
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

export async function removeMemberFromWorkspace(
	args: RemoveMemberFromWorkspaceArgs,
): Promise<RemoveMemberFromWorkspaceResult> {
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

export async function getAllWorkspacesForUser(
	args: GetAllWorkspacesForUserArgs,
): Promise<OrganizationWorkspaceGroup[]> {
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

export async function updateWorkspaceDetails(args: {
	workspaceId: string;
	name: string;
	domain: string;
}): Promise<{ workspace: Workspace; analysisReset: boolean }> {
	const { workspaceId, name, domain } = args;
	const nextName = name.trim();
	const nextDomain = domain.trim();

	const current = await getWorkspaceById({ workspaceId });
	const brandChanged =
		current.name.trim() !== nextName || current.domain.trim() !== nextDomain;

	await db
		.update(schema.workspaces)
		.set({ name: nextName, domain: nextDomain })
		.where(
			and(eq(schema.workspaces.id, workspaceId), isNull(schema.workspaces.deletedAt)),
		);

	if (brandChanged) {
		await resetWorkspaceAnalysis({ workspaceId });
	}

	const workspace = await getWorkspaceById({ workspaceId });
	return { workspace, analysisReset: brandChanged };
}

export async function updateOrganizationName(args: {
	workspaceId: string;
	organizationName: string;
}) {
	const { workspaceId, organizationName } = args;
	const workspace = await getWorkspaceById({ workspaceId });

	const baseSlug =
		organizationName
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 64) || "organization";

	let nextSlug = baseSlug;
	let attempt = 1;
	while (true) {
		const existing = await db.query.organization.findFirst({
			where: eq(schema.organization.slug, nextSlug),
		});
		if (!existing || existing.id === workspace.tenantId) break;
		attempt += 1;
		nextSlug = `${baseSlug}-${attempt}`;
	}

	await db
		.update(schema.organization)
		.set({ name: organizationName.trim(), slug: nextSlug })
		.where(eq(schema.organization.id, workspace.tenantId));

	return db.query.organization.findFirst({
		where: eq(schema.organization.id, workspace.tenantId),
	});
}

export async function getWorkspaceJoinInfo(args: { workspaceId: string }): Promise<{
	orgCode: string;
	workspaceCode: string;
	organization: { id: string; name: string; slug: string | null };
	workspace: { id: string; name: string; slug: string };
}> {
	const { workspaceId } = args;
	const workspace = await getWorkspaceById({ workspaceId });

	const organization = await db.query.organization.findFirst({
		where: eq(schema.organization.id, workspace.tenantId),
	});

	if (!organization) {
		throw new NotFoundError("Organization not found for this workspace.");
	}

	const orgCode = organization.slug ?? organization.id;
	const workspaceCode = formatWorkspaceJoinCode(orgCode, workspace.slug);

	return {
		orgCode,
		workspaceCode,
		organization: { id: organization.id, name: organization.name, slug: organization.slug },
		workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
	};
}

export async function addMemberToWorkspaceByEmail(args: {
	workspaceId: string;
	email: string;
	role?: "owner" | "member";
}): Promise<
	| { status: "not-found" }
	| { status: "already-member"; workspaceId: string; userId: string }
	| { status: "added"; workspaceId: string; userId: string; role: string }
> {
	const { workspaceId, email, role = "member" } = args;
	const workspace = await getWorkspaceById({ workspaceId });

	const targetUser = await db.query.user.findFirst({
		where: eq(schema.user.email, email),
	});

	if (!targetUser) {
		return { status: "not-found" };
	}

	const orgMembership = await db.query.member.findFirst({
		where: (m, { eq, and }) =>
			and(eq(m.organizationId, workspace.tenantId), eq(m.userId, targetUser.id)),
	});

	if (!orgMembership) {
		await db.insert(schema.member).values({
			id: newId("member"),
			organizationId: workspace.tenantId,
			userId: targetUser.id,
			role: "member",
			createdAt: new Date(),
		});
	}

	const existingWsMember = await db.query.workspaceMembers.findFirst({
		where: (wm, { eq, and, isNull }) =>
			and(eq(wm.workspaceId, workspaceId), eq(wm.userId, targetUser.id), isNull(wm.deletedAt)),
	});

	if (existingWsMember) {
		return { status: "already-member", workspaceId, userId: targetUser.id };
	}

	const res = await addMemberToWorkspace({ workspaceId, userId: targetUser.id, role });
	return { status: "added", ...res };
}

type JoinByCodeOrganization = { id: string; name: string; slug: string | null };
type JoinByCodeWorkspace = { id: string; name: string; slug: string };

export async function joinWorkspaceByCode(args: {
	code: string;
	userId: string;
}): Promise<
	| { status: "select-workspace"; organization: JoinByCodeOrganization; workspaces: JoinByCodeWorkspace[] }
	| { status: "joined"; organization: JoinByCodeOrganization; workspace: JoinByCodeWorkspace }
> {
	const { code, userId } = args;
	const rawCode = code.trim();

	let organization: JoinByCodeOrganization | null = null;
	let workspace: JoinByCodeWorkspace | null = null;

	if (rawCode.startsWith("workspace_")) {
		const workspaceRecord = await db.query.workspaces.findFirst({
			where: (ws, { and, eq, isNull }) => and(eq(ws.id, rawCode), isNull(ws.deletedAt)),
		});
		if (!workspaceRecord) throw new NotFoundError("Workspace not found for this code.");

		const orgRecord = await db.query.organization.findFirst({
			where: eq(schema.organization.id, workspaceRecord.tenantId),
		});
		if (!orgRecord) throw new NotFoundError("Organization not found for this workspace.");

		organization = { id: orgRecord.id, name: orgRecord.name, slug: orgRecord.slug };
		workspace = { id: workspaceRecord.id, name: workspaceRecord.name, slug: workspaceRecord.slug };
	} else {
		const parsed = parseWorkspaceJoinCode(rawCode);
		if (parsed) {
			const orgRecord = await db.query.organization.findFirst({
				where: (org, { eq, or }) =>
					or(eq(org.slug, parsed.orgCode), eq(org.id, parsed.orgCode)),
			});
			if (!orgRecord) throw new NotFoundError("Organization not found for this code.");

			const workspaceRecord = await db.query.workspaces.findFirst({
				where: (ws, { and, eq, isNull, or }) =>
					and(
						eq(ws.tenantId, orgRecord.id),
						isNull(ws.deletedAt),
						or(eq(ws.slug, parsed.workspaceCode), eq(ws.id, parsed.workspaceCode)),
					),
			});
			if (!workspaceRecord) throw new NotFoundError("Workspace not found for this code.");

			organization = { id: orgRecord.id, name: orgRecord.name, slug: orgRecord.slug };
			workspace = { id: workspaceRecord.id, name: workspaceRecord.name, slug: workspaceRecord.slug };
		} else {
			const orgRecord = await db.query.organization.findFirst({
				where: (org, { eq, or }) => or(eq(org.slug, rawCode), eq(org.id, rawCode)),
			});
			if (!orgRecord) throw new NotFoundError("Organization not found for this code.");

			const orgWorkspaces = await db
				.select({ id: schema.workspaces.id, name: schema.workspaces.name, slug: schema.workspaces.slug })
				.from(schema.workspaces)
				.where(and(eq(schema.workspaces.tenantId, orgRecord.id), isNull(schema.workspaces.deletedAt)))
				.execute();

			if (orgWorkspaces.length === 0) {
				throw new NotFoundError("No workspaces found for this organization.");
			}

			if (orgWorkspaces.length > 1) {
				return {
					status: "select-workspace",
					organization: { id: orgRecord.id, name: orgRecord.name, slug: orgRecord.slug },
					workspaces: orgWorkspaces,
				};
			}

			const onlyWorkspace = orgWorkspaces[0]!;
			const workspaceRecord = await db.query.workspaces.findFirst({
				where: (ws, { and, eq, isNull }) =>
					and(eq(ws.id, onlyWorkspace.id), isNull(ws.deletedAt)),
			});
			if (!workspaceRecord) throw new NotFoundError("Workspace not found for this code.");

			organization = { id: orgRecord.id, name: orgRecord.name, slug: orgRecord.slug };
			workspace = { id: workspaceRecord.id, name: workspaceRecord.name, slug: workspaceRecord.slug };
		}
	}

	if (!organization || !workspace) {
		throw new NotFoundError("Invalid workspace code.");
	}

	const orgMembership = await db.query.member.findFirst({
		where: (m, { eq, and }) =>
			and(eq(m.organizationId, organization!.id), eq(m.userId, userId)),
	});

	if (!orgMembership) {
		await db.insert(schema.member).values({
			id: newId("member"),
			organizationId: organization.id,
			userId,
			role: "member",
			createdAt: new Date(),
		});
	}

	const existingWsMember = await db.query.workspaceMembers.findFirst({
		where: (wm, { eq, and, isNull }) =>
			and(eq(wm.workspaceId, workspace!.id), eq(wm.userId, userId), isNull(wm.deletedAt)),
	});

	if (!existingWsMember) {
		await addMemberToWorkspace({ workspaceId: workspace.id, userId, role: "member" });
	}

	return { status: "joined", organization, workspace };
}

export async function setWorkspaceEnabledProviders(args: {
	workspaceId: string;
	providers: Provider[];
}): Promise<{ providers: Provider[] }> {
	const { workspaceId, providers } = args;
	await db
		.update(schema.workspaces)
		.set({ enabledProviders: JSON.stringify(providers) })
		.where(eq(schema.workspaces.id, workspaceId));
	return { providers };
}

export async function updateWorkspaceSchedule(args: {
	workspaceId: string;
	userId: string;
	schedule: string | null;
}): Promise<{ schedule: string | null }> {
	const { workspaceId, userId, schedule } = args;

	await db
		.update(schema.workspaces)
		.set({ schedule })
		.where(eq(schema.workspaces.id, workspaceId));

	if (schedule) {
		await scheduleCronForPrompts({ workspaceId, userId, cronExpression: schedule });
	} else {
		await unscheduleCronForPrompts({ workspaceId });
	}

	return { schedule };
}
