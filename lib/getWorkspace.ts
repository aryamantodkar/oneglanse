import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getTenant } from "./getTenant";


export async function getWorkspace() {
    const orgId = await getTenant()

    const workspace = await db.query.workspaces.findFirst({
        where: (table, { and, eq, isNull }) => and(eq(table.tenantId, orgId), isNull(table.deletedAt)),
    });
    if (!workspace) {
        redirect("/workspace/new");
    }

    return workspace
}
