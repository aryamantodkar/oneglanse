import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { workspaceRouter } from "./routers/workspace/workspace";
import { promptRouter } from "./routers/prompt/prompt";
import { cronRouter } from "./routers/cron/cron";
import { locationRouter } from "./routers/location/location";

export const appRouter = createTRPCRouter({
    workspace: workspaceRouter,
    prompt: promptRouter,
    cron: cronRouter,
    location: locationRouter
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
