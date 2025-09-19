import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { workspaceRouter } from "./routers/workspace/workspace";

export const appRouter = createTRPCRouter({
    workspace: workspaceRouter
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
