import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { workspaceRouter } from "./routers/workspace/workspace";
import { promptRouter } from "./routers/prompt/prompt";

export const appRouter = createTRPCRouter({
    workspace: workspaceRouter,
    prompt: promptRouter
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
