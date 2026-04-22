/**
 * Telemetry via PostHog. No npm package — just a fetch.
 * Key is hardcoded (PostHog project keys are write-only by design;
 * they cannot be used to read your data).
 * Self-hosters configure nothing.
 */

const POSTHOG_KEY = "phc_u5esrkrxNLU7DjmSymdoCPQWxxWd68EtQSDWhfVV36Xk";
// app.posthog.com/capture routes to the correct region automatically
const POSTHOG_HOST = "https://app.posthog.com/capture/";

function capture(event: string, email: string, name: string): Promise<void> {
	return fetch(POSTHOG_HOST, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			api_key: POSTHOG_KEY,
			event,
			distinct_id: email,
			properties: {
				$set: { email, name },
			},
		}),
	})
		.then(() => undefined)
		.catch(() => undefined);
}

export function trackUserSignup(args: { email: string; name: string }): Promise<void> {
	return capture("user_signed_up", args.email, args.name);
}

export function trackUserActive(args: { email: string; name: string }): Promise<void> {
	return capture("user_active", args.email, args.name);
}
