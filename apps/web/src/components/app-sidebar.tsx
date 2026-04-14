"use client";

import { formToolbarButtonClassName } from "@/components/forms/auth-form-chrome";
import { authClient } from "@/lib/auth/auth-client";
import { useSafeSearchParams } from "@/lib/navigation/use-safe-search-params";
import { api } from "@/trpc/react";
import type { Workspace } from "@oneglanse/db";
import {
	type AppMode,
	canAccessPeopleInMode,
	canAccessProvidersInMode,
	canAccessScheduleInMode,
	canRunPromptsNowInMode,
} from "@oneglanse/types";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
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
	toast,
} from "@oneglanse/ui";
import { cn, getFaviconUrls } from "@oneglanse/utils";
import {
	Check,
	ChevronDown,
	ChevronUp,
	Clock,
	Globe,
	LayoutGrid,
	Loader2,
	MessageSquare,
	Plug,
	Plus,
	Settings,
	User2,
	UserPlus,
	Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CreateWorkspaceDialog } from "./dialogs/create-workspace-dialog";
import { JoinWorkspaceDialog } from "./dialogs/join-workspace-dialog";

interface AppSidebarProps {
	appMode: AppMode;
	workspace: Workspace | null;
	userName: string;
	userEmail: string;
}

export function AppSidebar({
	appMode,
	workspace,
	userName,
	userEmail,
}: AppSidebarProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [showCreateWorkspaceDialog, setShowCreateWorkspaceDialog] =
		useState(false);
	const [showJoinWorkspaceDialog, setShowJoinWorkspaceDialog] = useState(false);
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSafeSearchParams();

	const activeOrgId = workspace?.tenantId ?? null;

	// Fetch all workspaces across all orgs for this user
	const allWorkspacesQuery = api.workspace.listAllForUser.useQuery();
	const groupedWorkspaces = allWorkspacesQuery.data ?? [];

	// Flat list of all workspaces for lookup
	const allWorkspaces = useMemo(() => {
		return groupedWorkspaces.flatMap((g) => g.workspaces);
	}, [groupedWorkspaces]);

	// Derive active workspace from URL params, falling back to server prop
	const workspaceIdFromUrl = searchParams.get("workspace");
	const activeWorkspace = useMemo(() => {
		if (workspaceIdFromUrl) {
			const match = allWorkspaces.find((ws) => ws.id === workspaceIdFromUrl);
			if (match) return match;
		}
		return workspace;
	}, [workspaceIdFromUrl, allWorkspaces, workspace]);

	const activeWorkspaceFavicon = useMemo(() => {
		return (
			getFaviconUrls(
				activeWorkspace?.domain ?? "",
				activeWorkspace?.name ?? "",
			)[0] ?? ""
		);
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

	if (canAccessPeopleInMode(appMode)) {
		generalItems.push({
			title: "People",
			url: `/people?workspace=${activeWorkspace?.id ?? ""}`,
			icon: Users,
		});
	}

	if (canAccessScheduleInMode(appMode)) {
		generalItems.splice(3, 0, {
			title: canRunPromptsNowInMode(appMode) ? "Run Prompts" : "Schedule",
			url: `/schedule?workspace=${activeWorkspace?.id ?? ""}`,
			icon: Clock,
		});
	}

	const settingsItems = [
		...(canAccessProvidersInMode(appMode)
			? [
					{
						title: "Providers",
						url: `/providers?workspace=${activeWorkspace?.id ?? ""}`,
						icon: Plug,
					},
				]
			: []),
		{
			title: "Settings",
			url: `/settings?workspace=${activeWorkspace?.id ?? ""}`,
			icon: Settings,
		},
	];

	const handleSwitchWorkspace = async (ws: Workspace) => {
		if (ws.id === activeWorkspace?.id) return;

		// If switching to a workspace in a different org, update active org
		if (ws.tenantId !== activeWorkspace?.tenantId) {
			try {
				await authClient.organization.setActive({
					organizationId: ws.tenantId,
				});
			} catch (err) {
				console.error("Failed to switch org:", err);
			}
		}

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
			<Sidebar className="flex h-full min-h-full flex-col self-stretch bg-white dark:bg-neutral-950">
				<SidebarHeader className="p-3">
					<SidebarMenu>
						<SidebarMenuItem>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<SidebarMenuButton
										className={cn(
											formToolbarButtonClassName,
											"h-11 px-4 hover:bg-stone-100 dark:hover:bg-neutral-900",
										)}
									>
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
								<DropdownMenuContent
									className="min-w-0 rounded-[24px] border-transparent bg-white p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_18px_-14px_rgba(15,23,42,0.12)] dark:bg-neutral-950 dark:shadow-[0_1px_2px_rgba(0,0,0,0.14),0_10px_24px_-16px_rgba(0,0,0,0.4)]"
									style={{
										width: "var(--radix-dropdown-menu-trigger-width)",
										maxWidth: "var(--radix-dropdown-menu-trigger-width)",
									}}
									align="start"
									sideOffset={8}
								>
									{allWorkspacesQuery.isLoading ? (
										<DropdownMenuItem disabled>
											<Loader2 className="h-4 w-4 animate-spin" />
											<span>Loading...</span>
										</DropdownMenuItem>
									) : groupedWorkspaces.length > 0 ? (
										groupedWorkspaces.map((group, idx) => (
											<div key={group.organization.id}>
												{idx > 0 && <DropdownMenuSeparator />}
												{groupedWorkspaces.length > 1 && (
													<DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
														{group.organization.name}
													</DropdownMenuLabel>
												)}
												{group.workspaces.map((ws: Workspace) => (
													<DropdownMenuItem
														key={ws.id}
														onClick={() => handleSwitchWorkspace(ws)}
														className="flex items-center gap-2 rounded-lg"
													>
														<img
															src={
																getFaviconUrls(ws.domain ?? "", ws.name)[0] ??
																""
															}
															alt=""
															className="w-4 h-4 rounded-sm shrink-0"
														/>
														<span className="truncate">{ws.name}</span>
														{ws.id === activeWorkspace?.id && (
															<Check className="ml-auto h-4 w-4 shrink-0" />
														)}
													</DropdownMenuItem>
												))}
											</div>
										))
									) : (
										<DropdownMenuItem disabled>
											<span className="text-muted-foreground">
												No workspaces yet
											</span>
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
									<DropdownMenuItem
										onClick={() => setShowJoinWorkspaceDialog(true)}
									>
										<UserPlus className="h-4 w-4" />
										<span>Join Workspace</span>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>

				<SidebarContent className="flex-1 overflow-y-auto">
					<SidebarGroup>
						<SidebarGroupLabel className="px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
							General
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{generalItems.map((item) => (
									<SidebarMenuItem key={item.title}>
										<SidebarMenuButton
											asChild
											isActive={pathname === item.url.split("?")[0]}
											className="h-11 rounded-[24px] px-4 text-[13px] font-medium"
										>
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
						<SidebarGroupLabel className="px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
							Settings
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{settingsItems.map((item) => (
									<SidebarMenuItem key={item.title}>
										<SidebarMenuButton
											asChild
											isActive={pathname === item.url.split("?")[0]}
											className="h-11 rounded-[24px] px-4 text-[13px] font-medium"
										>
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

				<SidebarFooter className="flex-shrink-0 p-3 pt-1">
					<SidebarMenu>
						<SidebarMenuItem>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<SidebarMenuButton
										className={cn(
											formToolbarButtonClassName,
											"h-11 px-4 hover:bg-stone-100 dark:hover:bg-neutral-900",
										)}
									>
										<User2 />
										<span className="truncate">
											{userName || userEmail || "Account"}
										</span>
										<ChevronUp className="ml-auto" />
									</SidebarMenuButton>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									side="top"
									sideOffset={8}
									className="min-w-0 rounded-[24px] border-transparent bg-white p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_18px_-14px_rgba(15,23,42,0.12)] dark:bg-neutral-950 dark:shadow-[0_1px_2px_rgba(0,0,0,0.14),0_10px_24px_-16px_rgba(0,0,0,0.4)]"
									style={{
										width: "var(--radix-dropdown-menu-trigger-width)",
										maxWidth: "var(--radix-dropdown-menu-trigger-width)",
									}}
								>
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

			<JoinWorkspaceDialog
				open={showJoinWorkspaceDialog}
				onOpenChange={setShowJoinWorkspaceDialog}
			/>
		</>
	);
}
