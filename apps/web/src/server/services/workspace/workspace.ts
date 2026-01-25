import "server-only";

import { auth } from "@lib/auth/auth";
import { ValidationError } from "@onescope/errors";
import { createWorkspaceForTenant } from "@onescope/services"

export async function createNewWorkspace(args: {
    name: string;
    slug: string;
    domain: string;
    country: string;
    region?: string | null;
    userId: string;           
    headers: Headers;
}) {
    const { name, slug, domain, country, region, userId, headers } = args;

    const orgData = await auth.api
    .createOrganization({
      body: {
        name: name,
        slug: slug,
        keepCurrentActiveOrganization: true,
      },
      headers,
    })

  if (!orgData?.id) {
    throw new ValidationError("Organization ID is undefined.");
  }

  const workspace = await createWorkspaceForTenant({name, slug, tenantId: orgData.id, domain, country, region, userId });

  return { workspace, org: orgData };
}

