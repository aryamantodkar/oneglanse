import { z } from "zod";
import { createTRPCRouter } from "@/server/api/trpc";
import { auth } from "@lib/auth/auth";
import { db, schema } from "@/server/db";
import type { Workspace, WorkspaceMember } from "@/server/db/types";
import { newId } from "@/lib/workspace/id";
import { eq, isNull, and } from "drizzle-orm";
import { AuthError, safeHandler, ValidationError, NotFoundError, ok } from "@/server/error";
import { uuidv4 } from "better-auth";

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

  await db.insert(schema.workspaceMembers).values({
    workspaceId: workspace.id,
    userId,
    role: "owner",
  });

  return { workspace, org: orgData };
}

export async function getWorkspaceById(args: {
  workspaceId: string;
}) {
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
        isNull(schema.workspaces.deletedAt)
      )
    )
    .execute();

  if (!workspace) {
    throw new NotFoundError(`Workspace with ID ${workspaceId} not found.`);
  }

  return workspace;
}

