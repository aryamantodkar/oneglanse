import "server-only";

import { auth } from "@lib/auth/auth";
import { db } from "@onescope/db";
import { BaseError, captureException } from "@onescope/errors";
import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

export const createTRPCContext = async (opts: { headers: Headers }) => {
	const session = await auth.api.getSession({ headers: opts.headers });

	return {
		db,
		auth,
		session,
		...opts,
	};
};

export const t = initTRPC.context<typeof createTRPCContext>().create({
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

function httpStatusToTRPCCode(status: number): TRPCError["code"] {
	if (status === 400) return "BAD_REQUEST";
	if (status === 401) return "UNAUTHORIZED";
	if (status === 403) return "FORBIDDEN";
	if (status === 404) return "NOT_FOUND";
	if (status === 429) return "TOO_MANY_REQUESTS";
	return "INTERNAL_SERVER_ERROR";
}

// Converts domain errors (BaseError subclasses) to typed TRPCError so the
// correct HTTP status code and error code flow through to the client.
const errorMappingMiddleware = t.middleware(async ({ next }) => {
	try {
		return await next();
	} catch (err) {
		if (err instanceof TRPCError) throw err;
		if (err instanceof BaseError) {
			throw new TRPCError({
				code: httpStatusToTRPCCode(err.status),
				message: err.message,
				cause: err,
			});
		}
		captureException(err);
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: err instanceof Error ? err.message : "Internal server error",
			cause: err,
		});
	}
});

export const baseProcedure = t.procedure.use(errorMappingMiddleware);

export const createCallerFactory = t.createCallerFactory;

export const createTRPCRouter = t.router;
