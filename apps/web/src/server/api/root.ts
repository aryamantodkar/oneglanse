import "server-only";

import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { workspaceRouter } from "./routers/workspace/workspace";
import { promptRouter } from "./routers/prompt/prompt";
import { locationRouter } from "./routers/location/location";
import { analysisRouter } from "./routers/analysis/analysis";
import { agentRouter } from "./routers/agent/agent";
import { internalRouter } from "./routers/internal/internal";

export const appRouter = createTRPCRouter({
    workspace: workspaceRouter,
    prompt: promptRouter,
    location: locationRouter,
    analysis: analysisRouter,
    agent: agentRouter,
    internal: internalRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
