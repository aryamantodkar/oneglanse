"use client"
import { Calendar, ChevronDown, ChevronUp, Globe, Home, LayoutGrid, Inbox, MessageSquare, Search, Settings, User2, Tag, Users, TrendingUp, Shield, Zap, Building, Briefcase, Loader2 } from "lucide-react"
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
import { authClient } from "@lib/auth-client";
import { useEffect, useState } from "react";

import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
  } from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation";
import { toast } from "sonner"

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

export function AppSidebar({ workspace } : { workspace: Workspace }) {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [currentOrg, setCurrentOrg] = useState(workspace?.name ?? "")

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
    <Sidebar>
        <SidebarHeader>
            <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <SidebarMenuButton>
                        <>{currentOrg ? currentOrg : "Select Workspace"}</>
                        <ChevronDown className="ml-auto" />
                    </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[--radix-popper-anchor-width]">
                        {organizations.map((organization) => (
                            <DropdownMenuItem
                                key={organization.id}
                                onClick={() => handleChangeOrganization(organization.id)}
                            >
                                <span>{organization.name}</span>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
            </SidebarMenu>
        </SidebarHeader>
      <SidebarContent>
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
          <SidebarGroupLabel>Preferences</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {preferenceItems.map((item) => (
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
          <SidebarGroupLabel>Preferences</SidebarGroupLabel>
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
      <SidebarFooter>
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