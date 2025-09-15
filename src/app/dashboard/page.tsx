"use client";

import { Logout } from "@/components/logout";
import { authClient } from "@lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardPage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending  && !session) {
      router.push("/");
    }
  }, [session, isPending, router]);

  if (isPending) return <div>Loading...</div>; 

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1>Dashboard</h1>
      <Logout />
    </div>
  );
}