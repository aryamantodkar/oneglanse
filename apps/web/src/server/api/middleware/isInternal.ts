import "server-only";

import { timingSafeEqual } from "crypto";
import { AuthError } from "@onescope/errors";
import { t } from "../trpc";

export const isInternal = t.middleware(({ next, ctx }) => {
	const secret = process.env.INTERNAL_CRON_SECRET;
	if (!secret) throw new Error("INTERNAL_CRON_SECRET not configured");

	const auth = ctx.headers.get("Authorization")?.trim() ?? "";
	const expected = `Bearer ${secret}`;

	const match =
		auth.length === expected.length &&
		timingSafeEqual(Buffer.from(auth), Buffer.from(expected));

	if (!match) throw new AuthError("Cron Secret is missing or invalid.");
	return next();
});
