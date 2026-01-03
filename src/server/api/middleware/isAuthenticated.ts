import { AuthError } from "@/lib/error";
import { t } from "../trpc";

export const isAuthenticated = t.middleware(async ({ next, ctx }) => {
	if (!ctx.session?.user) {
		throw new AuthError("User Id is undefined.");
	}
	return next({ 
		ctx: {
			user: ctx.session.user,
		}
	 });
});