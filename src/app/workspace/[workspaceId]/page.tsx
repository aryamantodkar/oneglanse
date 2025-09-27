
import { Header } from "@/components/header";
import PromptInput from "@/components/promptInput";
import { getWorkspace } from "@lib/getWorkspace";
import { redirect } from "next/navigation";

export default async function Workspace() {
    const workspace = await getWorkspace()
    if(!workspace){
        return(redirect('/workspace/new'))
    }
    return (
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex flex-1 justify-center items-center">
            <PromptInput workspaceId={""} userId={""} />
          </main>
        </div>
    );
}