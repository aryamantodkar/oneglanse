import { db, schema } from "@oneglanse/db";
import { newId } from "@oneglanse/utils";

// Private — ensures a user belongs to an org, inserting a member row if missing.
export async function ensureOrgMembership(
	organizationId: string,
	userId: string,
): Promise<void> {
	const existing = await db.query.member.findFirst({
		where: (m, { eq, and }) =>
			and(eq(m.organizationId, organizationId), eq(m.userId, userId)),
	});
	if (!existing) {
		await db.insert(schema.member).values({
			id: newId("member"),
			organizationId,
			userId,
			role: "member",
			createdAt: new Date(),
		});
	}
}
