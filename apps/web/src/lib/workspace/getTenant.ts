import { auth } from "@lib/auth/auth";
import { headers } from "next/headers";

export async function getTenant() {
	const session = await auth.api.getSession({
	  headers: await headers(),
	});
  
	if (!session) return null; 
  
	return session.session.activeOrganizationId ?? null;
  }