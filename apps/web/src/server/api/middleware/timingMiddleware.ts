import "server-only";

import { t } from "../trpc";

export const timingMiddleware = t.middleware(async ({ next }) => {
	const result = await next();

	return result;
});
