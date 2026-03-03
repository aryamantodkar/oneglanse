import "server-only";

import { createTRPCRouter } from "@/server/api/trpc";
import { authorizedWorkspaceRoutes } from "./_routes/authorizedRoutes";
import { protectedWorkspaceRoutes } from "./_routes/protectedRoutes";

export const workspaceRouter = createTRPCRouter({
	...protectedWorkspaceRoutes,
	...authorizedWorkspaceRoutes,
});
