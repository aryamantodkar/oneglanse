import { db, schema } from "@oneglanse/db";
import { and, count, eq, isNull } from "drizzle-orm";

export async function deleteUserAccount(args: {
	userId: string;
}): Promise<void> {
	const { userId } = args;

	// Find all orgs where this user is a member with owner role
	const ownerships = await db
		.select({ orgId: schema.member.organizationId })
		.from(schema.member)
		.where(
			and(eq(schema.member.userId, userId), eq(schema.member.role, "owner")),
		)
		.execute();

	for (const { orgId } of ownerships) {
		// Count all owners of this org
		const [ownerCount] = await db
			.select({ total: count() })
			.from(schema.member)
			.where(
				and(
					eq(schema.member.organizationId, orgId),
					eq(schema.member.role, "owner"),
				),
			)
			.execute();

		if ((ownerCount?.total ?? 0) > 1) {
			// Other owners exist — skip org deletion, just remove this user's membership
			continue;
		}

		// Sole owner: soft-delete all workspaces and their members in this org
		const orgWorkspaces = await db
			.select({ id: schema.workspaces.id })
			.from(schema.workspaces)
			.where(
				and(
					eq(schema.workspaces.tenantId, orgId),
					isNull(schema.workspaces.deletedAt),
				),
			)
			.execute();

		for (const ws of orgWorkspaces) {
			await db
				.update(schema.workspaceMembers)
				.set({ deletedAt: new Date() })
				.where(
					and(
						eq(schema.workspaceMembers.workspaceId, ws.id),
						isNull(schema.workspaceMembers.deletedAt),
					),
				)
				.execute();

			await db
				.update(schema.workspaces)
				.set({ deletedAt: new Date() })
				.where(eq(schema.workspaces.id, ws.id))
				.execute();
		}

		// Delete the org — cascades member and invitation rows via FK
		await db
			.delete(schema.organization)
			.where(eq(schema.organization.id, orgId))
			.execute();
	}

	// Soft-delete any remaining workspace memberships (for orgs with other owners)
	await db
		.update(schema.workspaceMembers)
		.set({ deletedAt: new Date() })
		.where(
			and(
				eq(schema.workspaceMembers.userId, userId),
				isNull(schema.workspaceMembers.deletedAt),
			),
		)
		.execute();

	// Delete the user row — cascades session, account, member rows via FK
	await db.delete(schema.user).where(eq(schema.user.id, userId)).execute();
}
