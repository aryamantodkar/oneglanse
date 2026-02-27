import { db, schema } from "@oneglanse/db";
import { eq } from "drizzle-orm";

export async function getActiveOrganization(userId: string | undefined) {
	if (!userId) return null;

	const memberUser = await db.query.member.findFirst({
		where: eq(schema.member.userId, userId),
	});

	if (!memberUser) return null;

	const activeOrganization = await db.query.organization.findFirst({
		where: eq(schema.organization.id, memberUser.organizationId),
	});

	return activeOrganization;
}
