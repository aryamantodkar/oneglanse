import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getTenant } from "./getTenant";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";


export async function getWorkspace() {
    const orgId = await getTenant();
    if (!orgId) return null; // don't redirect
  
    const workspace = await db.query.workspaces.findFirst({
      where: (table, { and, eq, isNull }) =>
        and(eq(table.tenantId, orgId), isNull(table.deletedAt)),
    });
  
    return workspace ?? null; // don't redirect
  }