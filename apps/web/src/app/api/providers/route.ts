import { auth } from "@/lib/auth/auth";
import { readProviderConnectionsState } from "@/lib/provider-connections/server";
import {
	resetProviderAuthData,
	spawnProviderAuthLogin,
} from "@oneglanse/services";
import { AUTH_PROVIDER_LIST, resolveAppMode } from "@oneglanse/types";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const connectProviderSchema = z.object({
	provider: z.enum(AUTH_PROVIDER_LIST),
	action: z.enum(["connect", "refresh"]).default("connect"),
});

function isLocalProvidersMode(): boolean {
	return resolveAppMode(process.env.ONEGLANSE_APP_MODE) === "local";
}

async function requireProvidersApiAccess() {
	if (isLocalProvidersMode()) {
		return null;
	}

	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (session) {
		return null;
	}

	return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET() {
	const unauthorizedResponse = await requireProvidersApiAccess();
	if (unauthorizedResponse) {
		return unauthorizedResponse;
	}

	return NextResponse.json(await readProviderConnectionsState());
}

export async function POST(request: Request) {
	const unauthorizedResponse = await requireProvidersApiAccess();
	if (unauthorizedResponse) {
		return unauthorizedResponse;
	}

	if (!isLocalProvidersMode()) {
		return NextResponse.json(
			{
				error:
					"Interactive provider connect and refresh are only available in local mode.",
			},
			{ status: 405 },
		);
	}

	try {
		const payload = connectProviderSchema.parse(await request.json());
		void payload.action;
		return NextResponse.json(await spawnProviderAuthLogin(payload.provider));
	} catch (error) {
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Invalid request",
			},
			{ status: 400 },
		);
	}
}

export async function DELETE() {
	const unauthorizedResponse = await requireProvidersApiAccess();
	if (unauthorizedResponse) {
		return unauthorizedResponse;
	}

	if (!isLocalProvidersMode()) {
		return NextResponse.json(
			{
				error: "Provider reset is only available in local mode.",
			},
			{ status: 405 },
		);
	}

	try {
		await Promise.all(
			AUTH_PROVIDER_LIST.map((authProvider) =>
				resetProviderAuthData(authProvider),
			),
		);
		return NextResponse.json({ ok: true });
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to reset providers",
			},
			{ status: 500 },
		);
	}
}
