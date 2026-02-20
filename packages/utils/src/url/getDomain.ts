export function getDomain(input: string): string {
	if (!input) return "";

	let value = input.trim();

	// Fix common malformed schemes
	value = value
		.replace(/^www:\/\//i, "https://")
		.replace(/^http(s?):\/\/\.+/i, "https://");

	// Ensure scheme exists so URL() can parse
	if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) {
		value = `https://${value}`;
	}

	try {
		const url = new URL(value);

		return url.hostname.replace(/^www\./i, "").replace(/\.+$/, ""); // trailing dots
	} catch {
		return "";
	}
}
