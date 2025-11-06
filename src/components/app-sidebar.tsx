"use client"
import { Clock, ChevronDown, ChevronUp, Globe, Home, LayoutGrid, Inbox, MessageSquare, Search, Settings, User2, Tag, Users, TrendingUp, Shield, Zap, Building, Briefcase, Loader2, Target } from "lucide-react"
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
} from "@/components/ui/sidebar"
import type { Organization, Workspace } from "@/server/db/types"
import { authClient } from "@/lib/auth/auth-client";
import { useEffect, useState } from "react";

import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
  } from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation";
import { toast } from "sonner"
import { api } from "@/trpc/react";

const preferenceItems = [
    {
        title: "Competitors",
        url: "#",
        icon: Zap, // tile/grid icon
    },
    {
        title: "Tags",
        url: "#",
        icon: Tag, // chat icon
    }
];

const SettingsItems = [
    {
        title: "People",
        url: "#",
        icon: Users, // group of people icon
    },
    {
        title: "Workspace",
        url: "#",
        icon: Briefcase, // building icon representing workspace
    },
    {
        title: "Organizations",
        url: "#",
        icon: Building, // briefcase icon representing organizations
    }
];

export function AppSidebar({ workspace } : { workspace: Workspace | null}) {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [currentOrg, setCurrentOrg] = useState(workspace?.name ?? "")
    const [faviconLoaded, setFaviconLoaded] = useState(false);
    const [faviconUrl, setfaviconUrl] = useState("");

    const { data: brandData } = api.brand.get.useQuery(
      { workspaceId: workspace!.id },
      { retry: 2, refetchOnWindowFocus: false, enabled: !!workspace?.id }
    );

    useEffect(() => {
      const url = brandData?.brand?.website
      ? `https://www.google.com/s2/favicons?sz=32&domain_url=${brandData?.brand?.website}`
      : null;

      if (url) {
        setfaviconUrl(url);
        const img = new window.Image();
        img.src = url;
        img.onload = () => setFaviconLoaded(true);
        img.onerror = () => setFaviconLoaded(false);
      } else {
        setFaviconLoaded(false);
      }
    }, [brandData]);

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
        {
          title: "Cron Jobs",
          url: `/cron?workspace=${workspace?.id ?? ""}`,
          icon: Clock,
        },
        {
          title: "Competitors",
          url: `/competitors?workspace=${workspace?.id ?? ""}`,
          icon: Target
          ,
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
        await authClient.organization.setActive({
            organizationId,
        });

        const selectedOrg = organizations.find((org) => org.id === organizationId);
        if (selectedOrg) {
            setCurrentOrg(selectedOrg.name);
        }
    }
    
    const handleLogout = async () => {
        setIsLoading(true)
        try{
            await authClient.signOut()
            toast.success("Signed out successfully!")
            
            router.refresh();
            router.push("/login")
          }
          catch(err){
            console.log(err)
            toast.error("Failed to sign out!")
          }
        setIsLoading(false)
    }

  return (
    <Sidebar className="flex flex-col h-screen">
        <SidebarHeader>
            <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <SidebarMenuButton>
                        {faviconLoaded && (
                          <img
                            src={faviconUrl!}
                            alt={`${currentOrg} favicon`}
                            className="w-4 h-4 rounded-sm"
                          />
                        )}
                        <>{currentOrg ? currentOrg : "Select Workspace"}</>
                        <ChevronDown className="ml-auto" />
                    </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-popper-anchor-width]">
                        {organizations.map((organization) => (
                            <DropdownMenuItem
                                key={organization.id}
                                onClick={() => handleChangeOrganization(organization.id)}
                                className="flex items-center gap-2"
                            >
                              {faviconLoaded && (
                                <img
                                  src={faviconUrl!}
                                  alt={`${organization.name} favicon`}
                                  className="w-4 h-4 rounded-sm"
                                />
                              )}
                                <span>{organization.name}</span>
                            </DropdownMenuItem>
                        ))}
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
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
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
              {SettingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
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
                    <User2 /> Username
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
                    {isLoading ? <Loader2 className="size-4 animate-spin"/> : <span>Sign out</span>}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
    </Sidebar>
  )
}