import { db } from "@onescope/db";
import { getTenant } from "./getTenant";

export async function getWorkspace() {
    const orgId = await getTenant();
    if (!orgId) return null; // don't redirect
  
    const workspace = await db.query.workspaces.findFirst({
      where: (table, { and, eq, isNull }) =>
        and(eq(table.tenantId, orgId), isNull(table.deletedAt)),
    });
  
    return workspace ?? null; // don't redirect
  }