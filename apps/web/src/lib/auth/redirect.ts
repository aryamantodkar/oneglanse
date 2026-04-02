export function getSafeAuthRedirectPath(
	rawNext: string | null | undefined,
): string {
	if (!rawNext) {
		return "/";
	}

	const normalizedNext = rawNext.trim();
	if (
		normalizedNext.length === 0 ||
		!normalizedNext.startsWith("/") ||
		normalizedNext.startsWith("//")
	) {
		return "/";
	}

	return normalizedNext;
}

export function getPostAuthProvidersPath(
	rawNext: string | null | undefined,
): string {
	const nextPath = getSafeAuthRedirectPath(rawNext);
	if (nextPath === "/" || nextPath === "/providers") {
		return "/providers";
	}

	return `/providers?next=${encodeURIComponent(nextPath)}`;
}

export function getPostProvidersContinuePath(args: {
	rawNext: string | null | undefined;
	workspaceId?: string | null;
}): string {
	const nextPath = getSafeAuthRedirectPath(args.rawNext);
	if (nextPath !== "/" && nextPath !== "/providers") {
		return nextPath;
	}

	if (args.workspaceId) {
		return `/dashboard?workspace=${encodeURIComponent(args.workspaceId)}`;
	}

	return "/workspace";
}
