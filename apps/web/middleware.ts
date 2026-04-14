import { auth } from "@/lib/auth/auth";
import {
	canAccessPeopleInMode,
	canAccessProvidersInMode,
	resolveAppMode,
} from "@oneglanse/types";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
	const appMode = resolveAppMode(process.env.ONEGLANSE_APP_MODE);
	const { pathname, searchParams } = request.nextUrl;

	// In local mode, /providers is the auth setup page and /api/providers powers
	// the connect buttons on that page. Both must work without an app session.
	const isLocalProvidersPage = appMode === "local" && pathname.startsWith("/providers");
	const isLocalProvidersApi =
		appMode === "local" && pathname.startsWith("/api/providers");
	const isPublicLocalProvidersRequest =
		isLocalProvidersPage || isLocalProvidersApi;

	const session = isPublicLocalProvidersRequest
		? null
		: await auth.api.getSession({ headers: request.headers });

	if (!session && !isPublicLocalProvidersRequest) {
		const loginUrl = new URL("/login", request.url);
		const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
		loginUrl.searchParams.set("next", requestPath);
		return NextResponse.redirect(loginUrl);
	}
	const workspaceId = searchParams.get("workspace");

	const workspaceUrl = new URL("/workspace", request.url);
	if (workspaceId) {
		workspaceUrl.searchParams.set("workspace", workspaceId);
	}

	if (pathname.startsWith("/providers") && !canAccessProvidersInMode(appMode)) {
		return NextResponse.redirect(workspaceUrl);
	}

	if (pathname.startsWith("/people") && !canAccessPeopleInMode(appMode)) {
		return NextResponse.redirect(workspaceUrl);
	}

	if (isLocalProvidersPage) {
		const requestHeaders = new Headers(request.headers);
		requestHeaders.set("x-oneglanse-public-providers", "1");
		return NextResponse.next({
			request: {
				headers: requestHeaders,
			},
		});
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!login|signup|_next|static|favicon.ico).*)"],
};
