// Procedures
import "server-only";

import { t } from "./trpc";
import { isAuthenticated } from "./middleware/isAuthenticated";
import { isInternal } from "./middleware/isInternal";
import { slidingWindowRateLimiter, fixedWindowRateLimiter } from "./middleware/rateLimiter";
import { timingMiddleware } from "./middleware/timingMiddleware";
import { validWorkspace } from "./middleware/validWorkspace";
import { workspaceInput } from "../db/schema";

export const publicProcedure = t.procedure.use(timingMiddleware);
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const authorizedWorkspaceProcedure = t.procedure
                                                .input(workspaceInput)
                                                .use(validWorkspace);

export const llmRateLimiter = authorizedWorkspaceProcedure.use(slidingWindowRateLimiter);
export const analysisRateLimiter = authorizedWorkspaceProcedure.use(fixedWindowRateLimiter);

export const internalProcedure = t.procedure.use(isInternal);