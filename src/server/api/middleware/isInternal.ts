import { AuthError } from "@/lib/error";
import { t } from "../trpc";

export const isInternal = t.middleware((opts) => {
	const { next, ctx } = opts;
	
	const auth = ctx.headers.get("Authorization");
  
	if (auth !== `Bearer ${process.env.INTERNAL_CRON_SECRET}`) {
	  throw new AuthError("Cron Secret is missing or invalid.");
	}
  
	return next();
});