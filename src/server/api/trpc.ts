import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { db } from "@/server/db";
import { auth } from "@lib/auth/auth";
import { fixedWindowRateLimiter, slidingWindowRateLimiter } from "@/lib/middleware/rateLimiter";

export const createTRPCContext = async (opts: { headers: Headers; isCron?: boolean }) => {
	const isCron = opts.headers.get("x-cron-secret") === process.env.CRON_SECRET;

	const session = isCron
		? null
		: await auth.api.getSession({ headers: opts.headers });

	return {
		db,
		auth,
		session,
		isCron,
		...opts,
	};
};

const t = initTRPC.context<typeof createTRPCContext>().create({
	transformer: superjson,
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				zodError:
					error.cause instanceof ZodError ? error.cause.flatten() : null,
			},
		};
	},
});

export const createCallerFactory = t.createCallerFactory;

export const createTRPCRouter = t.router;

const timingMiddleware = t.middleware(async ({ next, path }) => {
	const start = Date.now();

	if (t._config.isDev) {
		// artificial delay in dev
		const waitMs = Math.floor(Math.random() * 400) + 100;
		await new Promise((resolve) => setTimeout(resolve, waitMs));
	}

	const result = await next();

	const end = Date.now();
	console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

	return result;
});

const isAuthenticated = t.middleware(async ({ next, ctx }) => {
	if (ctx.isCron) {
		return next();
	}

	if (!ctx.session?.user) {
		throw new TRPCError({ code: "UNAUTHORIZED" });
	}
	return next({ 
		ctx: {
			...ctx,
			user: ctx.session.user,
		}
	 });
});

export const publicProcedure = t.procedure.use(timingMiddleware);
export const protectedProcedure = t.procedure.use(isAuthenticated);
export const llmRateLimiter = protectedProcedure.use(slidingWindowRateLimiter);
export const analysisRateLimiter = protectedProcedure.use(fixedWindowRateLimiter);
