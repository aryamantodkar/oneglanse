import "server-only";

import { AuthError } from "@onescope/errors";
import { t } from "../trpc";

export const isInternal = t.middleware(({ next, ctx }) => {
	const auth = ctx.headers.get("Authorization");
  
	if (auth !== `Bearer ${process.env.INTERNAL_CRON_SECRET}`) {
	  throw new AuthError("Cron Secret is missing or invalid.");
	}
  
	return next();
});