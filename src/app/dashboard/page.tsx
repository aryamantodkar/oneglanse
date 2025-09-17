"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog" 
import { createAuthClient } from "better-auth/react"
import { CreateOrganizationForm } from "@/components/forms/create-organization-form";

const { useSession } = createAuthClient() 

export default function DashboardPage() {
  const router = useRouter();
  
  const {
    data: session,
    isPending, 
    error, 
    refetch 
  } = useSession()

  useEffect(() => { 
    if (isPending  && !session) {
      router.push("/");
    }
  }, [session, isPending, router]);

  if (isPending) return <div>Loading...</div>; 

  return (
    <div className="flex flex-col h-screen">
      <main className="flex flex-col flex-1 gap-4 items-center justify-center">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Create Organization</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Organization</DialogTitle>
              <DialogDescription>
                Create a new organization to get started.
              </DialogDescription>
            </DialogHeader>
            <CreateOrganizationForm/>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}