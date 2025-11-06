"use client"
import { Button } from "../ui/button"
import { Loader2, LogOut } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { authClient } from "@/lib/auth/auth-client"

export function Logout() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    
    const handleLogout = async () => {
        setIsLoading(true)
        try{
            await authClient.signOut()
            toast.success("Signed out successfully!")
            router.push("/login")
          }
          catch(err){
            console.log(err)
            toast.error("Failed to sign out!")
          }
        setIsLoading(false)
    }

  return (
    <Button variant="outline" onClick={handleLogout}>
        {isLoading ? <Loader2 className="size-4 animate-spin"/> : <>Logout <LogOut className="size-4" /></>}
    </Button>       
  )
}