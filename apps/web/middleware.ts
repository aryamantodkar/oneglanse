import { auth } from "@/lib/auth/auth";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest): Promise<any> {
	const session = await auth.api.getSession({
		headers: request.headers,
	});
	
	if (!session) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!login|signup|_next|static|favicon.ico).*)"],
};
