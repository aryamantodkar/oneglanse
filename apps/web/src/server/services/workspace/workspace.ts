import "server-only";

import { auth } from "@lib/auth/auth";
import { db, schema } from "@oneglanse/db";
import type { Workspace } from "@oneglanse/db";
import { ValidationError } from "@oneglanse/errors";
import { createWorkspaceForTenant } from "@oneglanse/services";
import { and, eq } from "drizzle-orm";

export async function createNewWorkspace(args: {
	name: string;
	slug: string;
	domain: string;
	organizationName?: string;
	country: string;
	region?: string | null;
	userId: string;
	headers: Headers;
}): Promise<{ workspace: Workspace; org: any }> {
	const {
		name,
		slug,
		domain,
		organizationName,
		country,
		region,
		userId,
		headers,
	} = args;

	const orgData = await auth.api.createOrganization({
		body: {
			name: organizationName?.trim() || name,
			slug: slug,
			keepCurrentActiveOrganization: true,
		},
		headers,
	});

	if (!orgData?.id) {
		throw new ValidationError("Organization ID is undefined.");
	}

	const workspace = await createWorkspaceForTenant({
		name,
		slug,
		tenantId: orgData.id,
		domain,
		country,
		region,
		userId,
	});

	return { workspace, org: orgData };
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

	// Verify user is a member of the organization
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
