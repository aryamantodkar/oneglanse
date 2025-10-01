
import { getWorkspace } from "@lib/getWorkspace";
import { redirect } from "next/navigation";

export default async function Home() {
  const workspace = await getWorkspace()
  if(!workspace){
    return redirect("/workspace/new")
  }
  
  return redirect(`/dashboard?workspace=${workspace.id}`)
}