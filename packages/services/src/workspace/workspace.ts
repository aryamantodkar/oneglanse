import { db, schema } from "@onescope/db";
import type { Workspace } from "@onescope/db";
import { eq, isNull, and } from "drizzle-orm";
import { ValidationError, NotFoundError } from "@onescope/errors";
import { newId } from "@onescope/utils";

export async function createWorkspaceForTenant(args: {
  name: string;
  slug: string;
  domain: string;
  tenantId: string;
  country: string;
  region?: string | null;
  userId: string;
}) {
  const { name, slug, domain, tenantId, country, region, userId } = args;

  const workspace: Workspace = {
    id: newId("workspace"),
    name,
    slug,
    domain,
    tenantId,
    country, // new field
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

  return workspace;
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

