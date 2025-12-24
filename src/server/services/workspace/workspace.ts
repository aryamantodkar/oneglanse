import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { auth } from "@lib/auth/auth";
import { db, schema } from "@/server/db";
import type { Workspace } from "@/server/db/types";
import { newId } from "@/lib/workspace/id";
import { eq, isNull, and } from "drizzle-orm";
import { AuthError, safeHandler, ValidationError, NotFoundError, ok } from "@/lib/error";

export async function createNewWorkspace(args: {
    name: string;
    slug: string;
    domain: string;
    country: string;
    region?: string | null;
    userId?: string;           
    headers?: Headers;
}) {
    const { name, slug, domain, country, region, userId, headers } = args;

    if (!headers || !userId) {
        throw new AuthError("Headers or userId are undefined.");
    }

    if (!name || !domain || !slug || !country) {
      throw new ValidationError("Please fill all the mandatory fields.");
    }

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

  const workspace: Workspace = {
    id: newId("workspace"),
    name: name,
    slug: slug,
    domain: domain,
    tenantId: orgData.id,
    country: country, // new field
    region: region || null, // new field
    createdAt: new Date(),
    deletedAt: null,
  };

  await db
    .insert(schema.workspaces)
    .values(workspace)

  return { workspace, org: orgData };
}

export async function getWorkspaceById(args: {
    workspaceId: string;
    userId: string;
}) {
    const { workspaceId, userId } = args;

    if (!userId) {
        throw new AuthError("User Id is undefined.");
    }

    if (!workspaceId || workspaceId.trim() === "") {
      throw new ValidationError("Workspace ID is undefined.");
    }

    const workspace = await db
        .select()
        .from(schema.workspaces)
        .where(
            and(
                eq(schema.workspaces.id, workspaceId),
                isNull(schema.workspaces.deletedAt)
            )
        )
        .execute();

    if (!workspace || workspace.length === 0) {
        throw new NotFoundError(`Workspace with ID ${workspaceId} not found.`);
    }

    return workspace[0];
}