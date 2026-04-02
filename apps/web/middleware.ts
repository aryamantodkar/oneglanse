import { auth } from "@/lib/auth/auth";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest){
	const session = await auth.api.getSession({
		headers: request.headers,
	});
	
	if (!session) {
		const loginUrl = new URL("/login", request.url);
		const requestPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
		loginUrl.searchParams.set("next", requestPath);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!login|signup|_next|static|favicon.ico).*)"],
};
