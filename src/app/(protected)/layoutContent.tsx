// /app/LayoutContent.tsx (Client Component)
"use client";

import { usePathname, useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import type { Workspace } from "@/server/db/types";
import { useEffect } from "react";

export default function LayoutContent({ children, workspace }: { children: React.ReactNode, workspace: Workspace | null}) {
  const pathname = usePathname();
  const pageTitle = pathname?.split("/").filter(Boolean).pop() || "Home";
  const capitalizedTitle = pageTitle.charAt(0).toUpperCase() + pageTitle.slice(1);

  const router = useRouter();

  useEffect(() => {
    if (!workspace) {
      return router.push("/workspace/new");
    }
  }, [workspace, router]);
  
  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Redirecting to create a workspace...</p>
      </div>
    );
  }
  
  return (
    <div className="flex w-full h-screen">
      <AppSidebar workspace={workspace}/>
      <main className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-2 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-gray-700 hover:text-gray-900" />
            <h1 className="text-sm font-semibold text-gray-900">{capitalizedTitle}</h1>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-4">{children}</div>
      </main>
    </div>
  );
}