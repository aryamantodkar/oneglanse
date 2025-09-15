"use client"
import { Button } from "./ui/button"
import { Loader2, LogOut } from "lucide-react"
import { signOut } from "@/server/api/routers/users"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function Logout() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    
    const handleLogout = async () => {
        setIsLoading(true)
        const {success, message} = await signOut()
        if(success){
            toast.success(message as string)
            router.push("/")
        }
        else{
            toast.error(message as string)
        }
        setIsLoading(false)
    }

  return (
    <Button variant="outline" onClick={handleLogout}>
        {isLoading ? <Loader2 className="size-4 animate-spin"/> : <>Logout <LogOut className="size-4" /></>}
    </Button>       
  )
}