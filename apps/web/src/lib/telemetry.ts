/**
 * Telemetry via PostHog. No npm package — just a fetch.
 * Key is hardcoded (PostHog project keys are write-only by design;
 * they cannot be used to read your data).
 * Self-hosters configure nothing.
 *
 * To activate: replace POSTHOG_KEY with your key from
 * app.posthog.com → Settings → Project API key.
 */

const POSTHOG_KEY = "phc_u5esrkrxNLU7DjmSymdoCPQWxxWd68EtQSDWhfVV36Xk";

function capture(event: string, distinctId: string, props: Record<string, string>): void {
	if (!POSTHOG_KEY) return;
	void fetch("https://us.i.posthog.com/capture/", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			api_key: POSTHOG_KEY,
			event,
			distinct_id: distinctId,
			properties: props,
		}),
	}).catch(() => {});
}

export function trackUserSignup(args: { email: string; name: string }): void {
	capture("user_signed_up", args.email, { name: args.name });
}

export function trackUserActive(args: { email: string; name: string }): void {
	capture("user_active", args.email, { name: args.name });
}
