import { auth } from "@/lib/auth/auth";
import {
	canAccessPeopleInMode,
	canAccessProvidersInMode,
	resolveAppMode,
} from "@oneglanse/types";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	if (!session) {
		const loginUrl = new URL("/login", request.url);
		const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
		loginUrl.searchParams.set("next", requestPath);
		return NextResponse.redirect(loginUrl);
	}

	const appMode = resolveAppMode(process.env.ONEGLANSE_APP_MODE);
	const { pathname, searchParams } = request.nextUrl;
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

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!login|signup|_next|static|favicon.ico).*)"],
};
