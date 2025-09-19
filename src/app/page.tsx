import { authClient } from "@lib/auth-client";
import { getWorkspace } from "@lib/getWorkspace";
import { redirect } from "next/navigation";

export default async function Home() {
  const workspace = await getWorkspace()
  if(!workspace){
    return redirect("/workspace/new")
  }
  
  return redirect(`/workspace/${workspace.id}`)
}