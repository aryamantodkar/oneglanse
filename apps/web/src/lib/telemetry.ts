/**
 * Anonymous telemetry via PostHog.
 *
 * What is collected:
 *   - A one-way SHA-256 hash of the internal user ID (cannot be reversed to an email or name)
 *   - Event type: "user_signed_up" or "user_active"
 *   - Timestamp (implicit, added by PostHog on receipt)
 *
 * What is NOT collected: email, name, IP address, or any personally identifiable information.
 *
 * The PostHog project API key is hardcoded and write-only — it cannot be used to read data.
 * Self-hosters configure nothing; this runs automatically.
 */

import { createHash } from "node:crypto";

const POSTHOG_KEY = "phc_u5esrkrxNLU7DjmSymdoCPQWxxWd68EtQSDWhfVV36Xk";
const POSTHOG_HOST = "https://app.posthog.com/capture/";

function anonymousId(userId: string): string {
	return createHash("sha256").update(userId).digest("hex");
}

async function capture(event: string, userId: string): Promise<void> {
	try {
		const res = await fetch(POSTHOG_HOST, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				api_key: POSTHOG_KEY,
				event,
				distinct_id: anonymousId(userId),
			}),
		});
		if (!res.ok) {
			console.error("[telemetry] PostHog responded", res.status);
		}
	} catch (err) {
		console.error("[telemetry] fetch failed", err);
	}
}

export async function trackUserSignup(userId: string): Promise<void> {
	await capture("user_signed_up", userId);
}

export async function trackUserActive(userId: string): Promise<void> {
	await capture("user_active", userId);
}
