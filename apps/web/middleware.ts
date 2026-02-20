import { auth } from "@/lib/auth/auth";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	console.log("Session in middleware:", session);

	if (!session) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!login|signup|_next|static|favicon.ico).*)"],
};
