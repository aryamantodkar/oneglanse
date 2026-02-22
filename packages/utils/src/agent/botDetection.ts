export function getBotDetectionMessage(type: string): string {
	switch (type) {
		case "cloudflare":
			return "Cloudflare detected automation. Try using a VPN or wait a bit.";
		case "captcha":
			return "CAPTCHA detected. Please solve it in the browser.";
		case "turnstile":
			return "Turnstile challenge detected. Please complete it in the browser.";
		default:
			return "Bot detection triggered. Please try again.";
	}
}