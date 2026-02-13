// /app/LayoutContent.tsx (Client Component)
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { SidebarTrigger } from "@onescope/ui";
import { AppSidebar } from "@/components/app-sidebar";
import type { Workspace } from "@onescope/db";
import { useRef, useEffect } from "react";
import { Logout } from "@/components/forms/logout";
import { api } from "@/trpc/react";

export default function LayoutContent({ children, workspace, userName, userEmail }: { children: React.ReactNode, workspace: Workspace | null, userName: string, userEmail: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageTitle = pathname?.split("/").filter(Boolean).pop() || "Home";
  const capitalizedTitle = pageTitle.charAt(0).toUpperCase() + pageTitle.slice(1);
  const shownJobsRef = useRef<Set<string>>(new Set());

  const workspaceIdFromUrl = searchParams.get("workspace") ?? "";

  const shouldFetchWorkspace =
    !!workspaceIdFromUrl && workspace?.id !== workspaceIdFromUrl;
  const workspaceQuery = api.workspace.getById.useQuery(
    { workspaceId: workspaceIdFromUrl },
    { enabled: shouldFetchWorkspace }
  );

  const resolvedWorkspace = workspaceQuery.data?.data ?? workspace ?? null;

  useEffect(() => {
    shownJobsRef.current.clear();
  }, [resolvedWorkspace?.id]);
  
  if (!resolvedWorkspace) {
    return (
      <div className="ui-page-enter flex h-screen w-full">
        <main className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 p-2 transition-[background-color,border-color] duration-200">
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-semibold text-gray-900">Workspace Setup</h1>
            </div>

            {/* Logout button */}
            <div>
              <Logout />
            </div>
          </div>

          {/* Page content */}
          <div className="ui-page-enter flex-1 min-h-0 overflow-auto px-6">{children}</div>
        </main>
      </div>
    );
  }
  
  return (
    <div className="ui-page-enter flex h-screen w-full">
      <AppSidebar workspace={resolvedWorkspace} userName={userName} userEmail={userEmail} />
      <main className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between border-b border-gray-200 p-2 transition-[background-color,border-color] duration-200">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-gray-700 transition-colors duration-200 hover:text-gray-900" />
            <h1 className="text-sm font-semibold text-gray-900">{capitalizedTitle}</h1>
          </div>
          <Logout/>
        </div>

        {/* Page content */}
        <div className="ui-page-enter flex-1 min-h-0 overflow-auto px-6">{children}</div>
      </main>
    </div>
  );
}
