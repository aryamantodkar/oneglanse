/**
 * Telemetry via PostHog. No npm package — just a fetch.
 * Key is hardcoded (PostHog project keys are write-only by design).
 * Self-hosters configure nothing.
 */

const POSTHOG_KEY = "phc_u5esrkrxNLU7DjmSymdoCPQWxxWd68EtQSDWhfVV36Xk";
const POSTHOG_HOST = "https://app.posthog.com/capture/";

async function capture(event: string, email: string, name: string): Promise<void> {
	try {
		const res = await fetch(POSTHOG_HOST, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				api_key: POSTHOG_KEY,
				event,
				distinct_id: email,
				properties: { $set: { email, name } },
			}),
		});
		if (!res.ok) {
			console.error("[telemetry] PostHog responded", res.status);
		}
	} catch (err) {
		console.error("[telemetry] fetch failed", err);
	}
}

export async function trackUserSignup(args: { email: string; name: string }): Promise<void> {
	await capture("user_signed_up", args.email, args.name);
}

export async function trackUserActive(args: { email: string; name: string }): Promise<void> {
	await capture("user_active", args.email, args.name);
}
