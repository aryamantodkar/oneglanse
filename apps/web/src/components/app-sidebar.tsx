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
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  toast,
} from "@onescope/ui"
import type { Organization, Workspace } from "@onescope/db"
import { authClient } from "@/lib/auth/auth-client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { getModelFavicon } from "@onescope/utils";
import Link from "next/link";
import { CreateOrganizationDialog } from "./dialogs/create-organization-dialog";
import { CreateWorkspaceDialog } from "./dialogs/create-workspace-dialog";

interface AppSidebarProps {
  workspace: Workspace | null;
  userName: string;
  userEmail: string;
}

export function AppSidebar({ workspace, userName, userEmail }: AppSidebarProps) {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [activeOrgId, setActiveOrgId] = useState<string | null>(workspace?.tenantId ?? null);
    const [isSwitching, setIsSwitching] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showCreateOrgDialog, setShowCreateOrgDialog] = useState(false);
    const [showCreateWorkspaceDialog, setShowCreateWorkspaceDialog] = useState(false);
    const latestOrgSwitchRef = useRef<string | null>(null);
    const router = useRouter();
    const utils = api.useUtils();

    const activeOrg = useMemo(() => {
      return organizations.find((org) => org.id === activeOrgId) ?? null;
    }, [organizations, activeOrgId]);

    const workspaceDomain = useMemo(() => {
      if (!workspace?.domain) return "";
      return workspace.domain
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .trim();
    }, [workspace?.domain]);

    // Fetch workspaces for the active org
    const workspacesQuery = api.workspace.listByOrg.useQuery(
      { tenantId: activeOrgId ?? "" },
      { enabled: !!activeOrgId }
    );
    const workspaces = (workspacesQuery.data?.data ?? []) as Workspace[];

    const generalItems = [
      {
        title: "Dashboard",
        url: `/dashboard?workspace=${workspace?.id ?? ""}`,
        icon: LayoutGrid,
      },
      {
        title: "Prompts",
        url: `/prompts?workspace=${workspace?.id ?? ""}`,
        icon: MessageSquare,
      },
      {
        title: "Sources",
        url: `/sources?workspace=${workspace?.id ?? ""}`,
        icon: Globe,
      },
    ];

    const settingsItems = [
      {
        title: "People",
        url: `/people?workspace=${workspace?.id ?? ""}`,
        icon: Users,
      },
      {
        title: "Organizations",
        url: `/organizations?workspace=${workspace?.id ?? ""}`,
        icon: Building,
      },
    ];

    useEffect(() => {
      const fetchAllOrganizations = async () => {
        try {
          const { data, error } = await authClient.organization.list();
          if (error) {
            console.error("Failed to fetch organizations:", error);
            return;
          }
          const orgs = (data ?? []) as Organization[];
          setOrganizations(orgs);
        } catch (err) {
          console.error("Error fetching organizations:", err);
        }
      };

      fetchAllOrganizations();
    }, []);

    const handleChangeOrganization = async (organizationId: string) => {
      if (organizationId === activeOrgId) return;

      latestOrgSwitchRef.current = organizationId;
      setIsSwitching(true);

      try {
        await authClient.organization.setActive({ organizationId });

        // Bail if user already clicked another org
        if (latestOrgSwitchRef.current !== organizationId) return;

        setActiveOrgId(organizationId);

        const result = await utils.workspace.listByOrg.fetch({ tenantId: organizationId });

        if (latestOrgSwitchRef.current !== organizationId) return;

        if (result?.success && result.data && result.data.length > 0) {
          const firstWorkspace = result.data[0]!;
          router.refresh();
          router.push(`/dashboard?workspace=${firstWorkspace.id}`);
        } else {
          router.push("/workspace/new");
        }
      } catch (err) {
        console.error("Failed to switch organization:", err);
        toast.error("Failed to switch organization.");
      } finally {
        setIsSwitching(false);
      }
    };

    const handleSwitchWorkspace = (ws: Workspace) => {
      if (ws.id === workspace?.id) return;
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
                        src={getModelFavicon(workspaceDomain)}
                        alt="Favicon"
                        className="w-4 h-4 rounded-sm shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">
                          {activeOrg?.name ?? "Select Organization"}
                        </span>
                        {workspace && (
                          <span className="text-xs text-muted-foreground truncate">
                            {workspace.name}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSwitching ? (
                      <Loader2 className="ml-auto h-4 w-4 animate-spin shrink-0" />
                    ) : (
                      <ChevronDown className="ml-auto shrink-0" />
                    )}
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[--radix-popper-anchor-width]" align="start">
                  {/* Organization Section */}
                  <DropdownMenuLabel>Organizations</DropdownMenuLabel>
                  <DropdownMenuGroup>
                    {organizations.map((org) => (
                      <DropdownMenuItem
                        key={org.id}
                        onClick={() => handleChangeOrganization(org.id)}
                        className="flex items-center gap-2"
                      >
                        <span className="truncate">{org.name}</span>
                        {org.id === activeOrgId && (
                          <Check className="ml-auto h-4 w-4 shrink-0" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowCreateOrgDialog(true)}>
                    <Plus className="h-4 w-4" />
                    <span>Create Organization</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Workspace Section */}
                  <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
                  <DropdownMenuGroup>
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
                          <span className="truncate">{ws.name}</span>
                          {ws.id === workspace?.id && (
                            <Check className="ml-auto h-4 w-4 shrink-0" />
                          )}
                        </DropdownMenuItem>
                      ))
                    ) : (
                      <DropdownMenuItem disabled>
                        <span className="text-muted-foreground">No workspaces yet</span>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
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

      {/* Dialogs rendered outside the sidebar */}
      <CreateOrganizationDialog
        open={showCreateOrgDialog}
        onOpenChange={setShowCreateOrgDialog}
      />
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
