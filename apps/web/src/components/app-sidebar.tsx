"use client"

import {
  ChevronDown,
  ChevronUp,
  Globe,
  LayoutGrid,
  MessageSquare,
  Users,
  Building,
  Loader2,
  Plus,
  Check,
  User2,
} from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  toast,
} from "@onescope/ui"
import type { Workspace } from "@onescope/db"
import { authClient } from "@/lib/auth/auth-client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/trpc/react";
import { getFaviconUrls } from "@onescope/utils";
import Link from "next/link";
import { CreateWorkspaceDialog } from "./dialogs/create-workspace-dialog";

interface AppSidebarProps {
  workspace: Workspace | null;
  userName: string;
  userEmail: string;
}

export function AppSidebar({ workspace, userName, userEmail }: AppSidebarProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateWorkspaceDialog, setShowCreateWorkspaceDialog] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    const activeOrgId = workspace?.tenantId ?? null;

    // Fetch workspaces for the active org
    const workspacesQuery = api.workspace.listByOrg.useQuery(
      { tenantId: activeOrgId ?? "" },
      { enabled: !!activeOrgId }
    );
    const workspaces = (workspacesQuery.data?.data ?? []) as Workspace[];

    // Derive active workspace from URL params, falling back to server prop
    const workspaceIdFromUrl = searchParams.get("workspace");
    const activeWorkspace = useMemo(() => {
      if (workspaceIdFromUrl) {
        const match = workspaces.find(ws => ws.id === workspaceIdFromUrl);
        if (match) return match;
      }
      return workspace;
    }, [workspaceIdFromUrl, workspaces, workspace]);

    const activeWorkspaceFavicon = useMemo(() => {
      return getFaviconUrls(activeWorkspace?.domain ?? "", activeWorkspace?.name ?? "")[0] ?? "";
    }, [activeWorkspace?.domain, activeWorkspace?.name]);

    const generalItems = [
      {
        title: "Dashboard",
        url: `/dashboard?workspace=${activeWorkspace?.id ?? ""}`,
        icon: LayoutGrid,
      },
      {
        title: "Prompts",
        url: `/prompts?workspace=${activeWorkspace?.id ?? ""}`,
        icon: MessageSquare,
      },
      {
        title: "Sources",
        url: `/sources?workspace=${activeWorkspace?.id ?? ""}`,
        icon: Globe,
      },
    ];

    const settingsItems = [
      {
        title: "People",
        url: `/people?workspace=${activeWorkspace?.id ?? ""}`,
        icon: Users,
      },
      {
        title: "Organizations",
        url: `/organizations?workspace=${activeWorkspace?.id ?? ""}`,
        icon: Building,
      },
    ];

    const handleSwitchWorkspace = (ws: Workspace) => {
      if (ws.id === activeWorkspace?.id) return;
      router.push(`/dashboard?workspace=${ws.id}`);
    };

    const handleLogout = async () => {
      setIsLoading(true);
      try {
        await authClient.signOut();
        toast.success("Signed out successfully!");
        router.refresh();
        router.push("/login");
      } catch (err) {
        console.error(err);
        toast.error("Failed to sign out!");
      }
      setIsLoading(false);
    };

  return (
    <>
      <Sidebar className="flex flex-col h-screen">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={activeWorkspaceFavicon}
                        alt="Favicon"
                        className="w-4 h-4 rounded-sm shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">
                          {activeWorkspace?.name ?? "Select Workspace"}
                        </span>
                      </div>
                    </div>
                    <ChevronDown className="ml-auto shrink-0" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-popper-anchor-width]" align="start">
                  {workspacesQuery.isLoading ? (
                    <DropdownMenuItem disabled>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading...</span>
                    </DropdownMenuItem>
                  ) : workspaces.length > 0 ? (
                    workspaces.map((ws) => (
                      <DropdownMenuItem
                        key={ws.id}
                        onClick={() => handleSwitchWorkspace(ws)}
                        className="flex items-center gap-2"
                      >
                        <img
                          src={getFaviconUrls(ws.domain ?? "", ws.name)[0] ?? ""}
                          alt=""
                          className="w-4 h-4 rounded-sm shrink-0"
                        />
                        <span className="truncate">{ws.name}</span>
                        {ws.id === activeWorkspace?.id && (
                          <Check className="ml-auto h-4 w-4 shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <DropdownMenuItem disabled>
                      <span className="text-muted-foreground">No workspaces yet</span>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowCreateWorkspaceDialog(true)}
                    disabled={!activeOrgId}
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Workspace</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="flex-1 overflow-y-auto">
          <SidebarGroup>
            <SidebarGroupLabel>General</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {generalItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Settings</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {settingsItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="flex-shrink-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton>
                    <User2 /> {userName || userEmail || "Account"}
                    <ChevronUp className="ml-auto" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  className="w-[--radix-popper-anchor-width]"
                >
                  <DropdownMenuItem>
                    <span>Account</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <span>Billing</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <span>Sign out</span>
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {activeOrgId && (
        <CreateWorkspaceDialog
          open={showCreateWorkspaceDialog}
          onOpenChange={setShowCreateWorkspaceDialog}
          tenantId={activeOrgId}
        />
      )}
    </>
  )
}
