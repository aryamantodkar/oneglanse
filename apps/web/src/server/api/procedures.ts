// Procedures
import "server-only";

import { schema } from "@oneglanse/db";
import { isAuthenticated } from "./middleware/isAuthenticated";
import { isInternal } from "./middleware/isInternal";
import { timingMiddleware } from "./middleware/timingMiddleware";
import { validWorkspace } from "./middleware/validWorkspace";
import { t } from "./trpc";
import { errorMappingMiddleware } from "./middleware/errorMapping";

const baseProcedure = t.procedure.use(errorMappingMiddleware);
export const publicProcedure = baseProcedure.use(timingMiddleware);
export const protectedProcedure = baseProcedure.use(isAuthenticated);
export const authorizedWorkspaceProcedure = baseProcedure
	.input(schema.workspaceInput)
	.use(validWorkspace);

export const internalProcedure = baseProcedure.use(isInternal);
