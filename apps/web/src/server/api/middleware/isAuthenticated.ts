import "server-only";

import { AuthError } from "@oneglanse/errors";
import { t } from "../trpc";

export const isAuthenticated = t.middleware(async ({ next, ctx }) => {
	if (!ctx.session?.user) {
		throw new AuthError("User Id is undefined.");
	}
	return next({
		ctx: {
			user: ctx.session.user,
		},
	});
});
