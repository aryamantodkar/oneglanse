import "server-only";

import { t } from "../trpc";

export const timingMiddleware = t.middleware(async ({ next, path }) => {
	const start = Date.now();

	const result = await next();

	const end = Date.now();
	console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

	return result;
});
