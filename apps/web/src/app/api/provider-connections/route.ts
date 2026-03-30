import {
	getAuthModuleState,
	getAuthProviderCards,
	readProviderAuthStatuses,
	spawnProviderAuthLogin,
} from "@oneglanse/services";
import { AUTH_PROVIDER_LIST } from "@oneglanse/types";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const connectProviderSchema = z.object({
	provider: z.enum(AUTH_PROVIDER_LIST),
});

export async function GET() {
	const [cards, statuses] = await Promise.all([
		Promise.resolve(getAuthProviderCards()),
		readProviderAuthStatuses(),
	]);
	const statusMap = new Map(
		statuses.map((status) => [status.provider, status] as const),
	);

	return NextResponse.json({
		...getAuthModuleState(),
		cards: cards.map((card) => ({
			...card,
			status: statusMap.get(card.provider) ?? {
				provider: card.provider,
				connected: false,
				connecting: false,
				synced: false,
				lastUpdatedAt: null,
				syncedAt: null,
				error: null,
			},
		})),
	});
}

export async function POST(request: Request) {
	try {
		const payload = connectProviderSchema.parse(await request.json());
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
