import { auth } from "@lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function getTenant() {
    const session = await auth.api.getSession({
		headers: await headers()
	})

	if(!session){
		return redirect("/login")
	}

	const orgId = session?.session.activeOrganizationId
	if (orgId) return orgId;

	return redirect("/workspace/new");
}
