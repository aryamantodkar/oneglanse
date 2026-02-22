import { BaseError, captureException } from "@onescope/errors";
import { TRPCError } from "@trpc/server";
import { t } from "../trpc";

const HTTP_STATUS_TO_TRPC_CODE: Record<number, TRPCError["code"]> = {
	400: "BAD_REQUEST",
	401: "UNAUTHORIZED",
	403: "FORBIDDEN",
	404: "NOT_FOUND",
	409: "CONFLICT",
	422: "UNPROCESSABLE_CONTENT",
	429: "TOO_MANY_REQUESTS",
	500: "INTERNAL_SERVER_ERROR",
	502: "BAD_GATEWAY",
	503: "SERVICE_UNAVAILABLE",
};

export const errorMappingMiddleware = t.middleware(async ({ next }) => {
	try {
		return await next();
	} catch (err) {
		if (err instanceof TRPCError) throw err;
		if (err instanceof BaseError) {
			throw new TRPCError({
				code: HTTP_STATUS_TO_TRPC_CODE[err.status] ?? "INTERNAL_SERVER_ERROR",
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