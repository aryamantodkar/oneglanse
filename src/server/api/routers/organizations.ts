"use server";

import { auth } from "@lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { eq, inArray } from "drizzle-orm";
import { member, organization, user } from "@/server/db/auth-schema";
import { getCurrentUser } from "./users";

export async function getOrganizations() {
    const { currentUser } = await getCurrentUser()

    const members = await db.query.member.findMany({
        where: eq(member.userId, currentUser.id)
    })

    const organizations = await db.query.organization.findMany({
        where: inArray(organization.id, members.map((member) => member.organizationId))
    })

    return organizations;
}

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