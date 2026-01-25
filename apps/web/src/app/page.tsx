import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { authClient } from "@/lib/auth/auth-client";
import { getWorkspace } from "@/lib/workspace/getWorkspace";

export default async function Home() {
  const session = await auth.api.getSession({
		headers: await headers()
	})

  if(!session){
		return redirect("/login")
	}

  const workspace = await getWorkspace();

  if (!workspace) return redirect("/workspace/new");
  
  const { data: organizations, error } = await authClient.organization.list();
  if (error) {
    console.error("Failed to fetch organizations:", error);
  } else if (organizations && organizations.length > 0) {
    const randomOrg =
      organizations[Math.floor(Math.random() * organizations.length)];

    await authClient.organization.setActive({
      organizationId: randomOrg?.id ?? "",
    });
  }
  
  return redirect(`/dashboard?workspace=${workspace.id}`)
}