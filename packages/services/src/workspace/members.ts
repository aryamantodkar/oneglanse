import { db, schema } from "@oneglanse/db";
import { NotFoundError, ValidationError } from "@oneglanse/errors";
import type {
	AddMemberToWorkspaceArgs,
	AddMemberToWorkspaceResult,
	RemoveMemberFromWorkspaceArgs,
	RemoveMemberFromWorkspaceResult,
} from "@oneglanse/types";
import { parseWorkspaceJoinCode } from "@oneglanse/utils";
import { and, eq, isNull } from "drizzle-orm";
import { ensureOrgMembership } from "./_internal/ensureOrgMembership.js";
import type {
	JoinByCodeOrganization,
	JoinByCodeWorkspace,
} from "./_internal/types.js";
import { getWorkspaceById } from "./query.js";

export async function addMemberToWorkspace(
	args: AddMemberToWorkspaceArgs,
): Promise<AddMemberToWorkspaceResult> {
	const { workspaceId, userId, role = "member" } = args;

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

	await db
		.insert(schema.workspaceMembers)
		.values({ workspaceId, userId, role });

	return { workspaceId, userId, role };
}

export async function removeMemberFromWorkspace(
	args: RemoveMemberFromWorkspaceArgs,
): Promise<RemoveMemberFromWorkspaceResult> {
	const { workspaceId, userId } = args;

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

	// Only query owner count when the member being removed is an owner
	if (memberToRemove.role === "owner") {
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

		if (owners.length <= 1) {
			throw new ValidationError("Cannot remove the last owner of a workspace.");
		}
	}

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

	await ensureOrgMembership(workspace.tenantId, targetUser.id);

	const existingWsMember = await db.query.workspaceMembers.findFirst({
		where: (wm, { eq, and, isNull }) =>
			and(
				eq(wm.workspaceId, workspaceId),
				eq(wm.userId, targetUser.id),
				isNull(wm.deletedAt),
			),
	});

	if (existingWsMember) {
		return { status: "already-member", workspaceId, userId: targetUser.id };
	}

	const res = await addMemberToWorkspace({
		workspaceId,
		userId: targetUser.id,
		role,
	});
	return { status: "added", ...res };
}

export async function joinWorkspaceByCode(args: {
	code: string;
	userId: string;
}): Promise<
	| {
			status: "select-workspace";
			organization: JoinByCodeOrganization;
			workspaces: JoinByCodeWorkspace[];
	  }
	| {
			status: "joined";
			organization: JoinByCodeOrganization;
			workspace: JoinByCodeWorkspace;
	  }
> {
	const { code, userId } = args;
	const rawCode = code.trim();

	let organization: JoinByCodeOrganization | null = null;
	let workspace: JoinByCodeWorkspace | null = null;

	if (rawCode.startsWith("workspace_")) {
		const workspaceRecord = await db.query.workspaces.findFirst({
			where: (ws, { and, eq, isNull }) =>
				and(eq(ws.id, rawCode), isNull(ws.deletedAt)),
		});
		if (!workspaceRecord)
			throw new NotFoundError("Workspace not found for this code.");

		const orgRecord = await db.query.organization.findFirst({
			where: eq(schema.organization.id, workspaceRecord.tenantId),
		});
		if (!orgRecord)
			throw new NotFoundError("Organization not found for this workspace.");

		organization = {
			id: orgRecord.id,
			name: orgRecord.name,
			slug: orgRecord.slug,
		};
		workspace = {
			id: workspaceRecord.id,
			name: workspaceRecord.name,
			slug: workspaceRecord.slug,
		};
	} else {
		const parsed = parseWorkspaceJoinCode(rawCode);
		if (parsed) {
			const orgRecord = await db.query.organization.findFirst({
				where: (org, { eq, or }) =>
					or(eq(org.slug, parsed.orgCode), eq(org.id, parsed.orgCode)),
			});
			if (!orgRecord)
				throw new NotFoundError("Organization not found for this code.");

			const workspaceRecord = await db.query.workspaces.findFirst({
				where: (ws, { and, eq, isNull, or }) =>
					and(
						eq(ws.tenantId, orgRecord.id),
						isNull(ws.deletedAt),
						or(
							eq(ws.slug, parsed.workspaceCode),
							eq(ws.id, parsed.workspaceCode),
						),
					),
			});
			if (!workspaceRecord)
				throw new NotFoundError("Workspace not found for this code.");

			organization = {
				id: orgRecord.id,
				name: orgRecord.name,
				slug: orgRecord.slug,
			};
			workspace = {
				id: workspaceRecord.id,
				name: workspaceRecord.name,
				slug: workspaceRecord.slug,
			};
		} else {
			const orgRecord = await db.query.organization.findFirst({
				where: (org, { eq, or }) =>
					or(eq(org.slug, rawCode), eq(org.id, rawCode)),
			});
			if (!orgRecord)
				throw new NotFoundError("Organization not found for this code.");

			const orgWorkspaces = await db
				.select({
					id: schema.workspaces.id,
					name: schema.workspaces.name,
					slug: schema.workspaces.slug,
				})
				.from(schema.workspaces)
				.where(
					and(
						eq(schema.workspaces.tenantId, orgRecord.id),
						isNull(schema.workspaces.deletedAt),
					),
				)
				.execute();

			if (orgWorkspaces.length === 0) {
				throw new NotFoundError("No workspaces found for this organization.");
			}

			if (orgWorkspaces.length > 1) {
				return {
					status: "select-workspace",
					organization: {
						id: orgRecord.id,
						name: orgRecord.name,
						slug: orgRecord.slug,
					},
					workspaces: orgWorkspaces,
				};
			}

			// Single workspace — reuse already-fetched data, no second DB call needed
			organization = {
				id: orgRecord.id,
				name: orgRecord.name,
				slug: orgRecord.slug,
			};
			workspace = orgWorkspaces[0] as JoinByCodeWorkspace;
		}
	}

	if (!organization || !workspace) {
		throw new NotFoundError("Invalid workspace code.");
	}
	const joinedWorkspace = workspace;

	await ensureOrgMembership(organization.id, userId);

	const existingWsMember = await db.query.workspaceMembers.findFirst({
		where: (wm, { eq, and, isNull }) =>
			and(
				eq(wm.workspaceId, joinedWorkspace.id),
				eq(wm.userId, userId),
				isNull(wm.deletedAt),
			),
	});

	if (!existingWsMember) {
		await addMemberToWorkspace({
			workspaceId: joinedWorkspace.id,
			userId,
			role: "member",
		});
	}

	return { status: "joined", organization, workspace: joinedWorkspace };
}
