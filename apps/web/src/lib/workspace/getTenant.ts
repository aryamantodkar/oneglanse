import { auth } from "@lib/auth/auth";
import { headers } from "next/headers";

export async function getTenant(): Promise<string | null> {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) return null;

	// activeOrganizationId is added via databaseHooks in auth config
	const sessionWithOrg = session.session as typeof session.session & {
		activeOrganizationId?: string | null;
	};
	return sessionWithOrg.activeOrganizationId ?? null;
}
