// /app/LayoutContent.tsx (Client Component)
"use client";

import { usePathname, useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import type { Workspace } from "@/server/db/types";
import { useEffect, useRef } from "react";
import { Logout } from "@/components/forms/logout";
import { useFailedJobs } from "@/lib/helper/mutations";
import { toast } from "sonner";

export default function LayoutContent({ children, workspace }: { children: React.ReactNode, workspace: Workspace | null}) {
  const pathname = usePathname();
  const pageTitle = pathname?.split("/").filter(Boolean).pop() || "Home";
  const capitalizedTitle = pageTitle.charAt(0).toUpperCase() + pageTitle.slice(1);
  const shownJobsRef = useRef<Set<string>>(new Set());

  const router = useRouter();
  const { data: failedJobs, isLoading } = useFailedJobs(workspace?.id ?? "");

  useEffect(() => {
    if (!workspace) {
      return router.push("/workspace/new");
    }
  }, [workspace, router]);

  useEffect(() => {
    shownJobsRef.current.clear();
  }, [workspace?.id]);

  useEffect(() => {
    if (!failedJobs?.data?.length) return;
  
    failedJobs.data.forEach(job => {
      if (!shownJobsRef.current.has(job.job_id)) {
        toast.error(`Job failed: ${job.error}`);
        shownJobsRef.current.add(job.job_id);
      }
    });
  }, [failedJobs]);
  
  if (!workspace) {
    return (
      <div className="flex w-full h-screen">
        <main className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between p-2 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <h1 className="text-sm font-semibold text-gray-900">New Workspace</h1>
            </div>

            {/* Logout button */}
            <div>
              <Logout />
            </div>
          </div>

          {/* Page content */}
          <div className="flex-1 overflow-auto min-h-0 px-6">{children}</div>
        </main>
      </div>
    );
  }
  
  return (
    <div className="flex w-full h-screen">
      <AppSidebar workspace={workspace}/>
      <main className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between p-2 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-gray-700 hover:text-gray-900" />
            <h1 className="text-sm font-semibold text-gray-900">{capitalizedTitle}</h1>
          </div>
          <Logout/>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto min-h-0 px-6">{children}</div>
      </main>
    </div>
  );
}