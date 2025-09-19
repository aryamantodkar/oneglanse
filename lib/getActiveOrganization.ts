import { db } from "@/server/db";
import { member, organization } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function getActiveOrganization(userId: string) {
    const memberUser = await db.query.member.findFirst({
        where: eq(member.userId, userId)
    })

    if(!memberUser) return null;

    const activeOrganization = await db.query.organization.findFirst({
        where: eq(organization.id,memberUser.organizationId)
    })

    return activeOrganization;
}