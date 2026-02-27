import "server-only";

import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { agentRouter } from "./routers/agent/agent";
import { analysisRouter } from "./routers/analysis/analysis";
import { internalRouter } from "./routers/internal/internal";
import { locationRouter } from "./routers/location/location";
import { promptRouter } from "./routers/prompt/prompt";
import { workspaceRouter } from "./routers/workspace/workspace";

export const appRouter = createTRPCRouter({
	workspace: workspaceRouter,
	prompt: promptRouter,
	location: locationRouter,
	analysis: analysisRouter,
	agent: agentRouter,
	internal: internalRouter,
});

export type AppRouter = typeof appRouter;

const createCaller = createCallerFactory(appRouter);
