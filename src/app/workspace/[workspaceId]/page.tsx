
import { Header } from "@/components/header";
import { getWorkspace } from "@lib/getWorkspace";
import { redirect } from "next/navigation";

export default async function Workspace() {
    const workspace = await getWorkspace()
    if(!workspace){
        return(redirect('/workspace/new'))
    }
    return (
        <div>
            <Header/>
        </div>
    )
}