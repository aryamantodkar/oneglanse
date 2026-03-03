import "server-only";

import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { agentRouter } from "./routers/agent";
import { analysisRouter } from "./routers/analysis";
import { internalRouter } from "./routers/internal";
import { locationRouter } from "./routers/location";
import { promptRouter } from "./routers/prompt";
import { workspaceRouter } from "./routers/workspace";

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
