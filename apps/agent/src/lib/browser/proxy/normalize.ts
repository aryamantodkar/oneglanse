function isValidPort(port: string): boolean {
	const parsed = Number(port);
	return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535;
}

function normalizeColonAuthProxy(proxy: string): string | null {
	// Supports provider format: host:port:username:password
	// and scheme://host:port:username:password
	const withSchemeMatch = proxy.match(
		/^(https?|socks5):\/\/([^:/\s]+):(\d{1,5}):([^:]+):(.+)$/i,
	);
	if (withSchemeMatch) {
		const scheme = (withSchemeMatch[1] ?? "").toLowerCase();
		const host = withSchemeMatch[2];
		const port = withSchemeMatch[3];
		const username = withSchemeMatch[4];
		const password = withSchemeMatch[5];
		if (!host || !port || !username || !password || !isValidPort(port)) return null;
		const encodedUsername = encodeURIComponent(username);
		const encodedPassword = encodeURIComponent(password);
		return `${scheme}://${encodedUsername}:${encodedPassword}@${host}:${port}`;
	}

	const noSchemeMatch = proxy.match(
		/^([^:/\s]+):(\d{1,5}):([^:]+):(.+)$/,
	);
	if (!noSchemeMatch) return null;

	const [, host, port, username, password] = noSchemeMatch;
	if (!host || !port || !username || !password || !isValidPort(port)) return null;
	const encodedUsername = encodeURIComponent(username);
	const encodedPassword = encodeURIComponent(password);
	return `http://${encodedUsername}:${encodedPassword}@${host}:${port}`;
}

export function normalizeProxy(proxy: string): string {
	const trimmed = proxy.trim();
	if (!trimmed) return "";

	const colonAuthNormalized = normalizeColonAuthProxy(trimmed);
	if (colonAuthNormalized) return colonAuthNormalized;

	const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
	const candidate = hasScheme ? trimmed : `http://${trimmed}`;

	try {
		const parsed = new URL(candidate);
		const protocol = parsed.protocol.toLowerCase();
		if (!["http:", "https:", "socks5:"].includes(protocol)) return "";
		if (!parsed.hostname || !parsed.port) return "";

		const auth =
			parsed.username || parsed.password
				? `${parsed.username}${parsed.password ? `:${parsed.password}` : ""}@`
				: "";
		const host =
			parsed.hostname.includes(":") && !parsed.hostname.startsWith("[")
				? `[${parsed.hostname}]`
				: parsed.hostname;
		return `${protocol}//${auth}${host}:${parsed.port}`;
	} catch {
		return "";
	}
}
