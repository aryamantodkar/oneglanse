// Procedures
import "server-only";

import { schema } from "@onescope/db";
import { isAuthenticated } from "./middleware/isAuthenticated";
import { isInternal } from "./middleware/isInternal";
import { timingMiddleware } from "./middleware/timingMiddleware";
import { validWorkspace } from "./middleware/validWorkspace";
import { t } from "./trpc";

export const publicProcedure = t.procedure.use(timingMiddleware);
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const authorizedWorkspaceProcedure = t.procedure
	.input(schema.workspaceInput)
	.use(validWorkspace);

export const internalProcedure = t.procedure.use(isInternal);
