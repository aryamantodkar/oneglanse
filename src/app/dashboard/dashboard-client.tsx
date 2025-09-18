"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createAuthClient } from "better-auth/react"

const { useSession } = createAuthClient() 

export default function DashboardClient({ organizations }: { organizations: any[] }) {
    const router = useRouter();
    const {
        data: session,
        isPending,
        error, 
        refetch 
    } = useSession()

    useEffect(() => { 
      console.log("user", session);
      if (!isPending && !session) {
        router.push("/");
      }
    }, [session, isPending, router]);

    useEffect(() => {
      if (organizations.length === 0) {
        router.push("/workspace/new");
      }
    }, [organizations, router]);

    if (organizations.length === 0) return null;
    
  return (
    <div className="flex flex-col h-screen">
      <main className="flex flex-col flex-1 gap-4 items-center justify-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <ul>
          {organizations.map((org) => (
            <li key={org.id}>{org.name}</li>
          ))}
        </ul>
      </main>
    </div>
  )
}
