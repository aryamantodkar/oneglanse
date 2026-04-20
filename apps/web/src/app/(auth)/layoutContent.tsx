// /app/LayoutContent.tsx (Client Component)
"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { formToolbarButtonClassName } from "@/components/forms/auth-form-chrome";
import { ProviderRunToastManager } from "@/components/provider-run-toast";
import { ProvidersScreen } from "@/components/providers-screen";
import { signOutAndRedirect } from "@/lib/auth/logout";
import { getPostProvidersContinuePath } from "@/lib/auth/redirect";
import { useSafeSearchParams } from "@/lib/navigation/use-safe-search-params";
import { useProviderConnections } from "@/lib/provider-connections/client";
import {
	SKIP_PROVIDER_GATE_EVENT,
	readSkipProviderGate,
	writeSkipProviderGate,
} from "@/lib/provider-connections/provider-gate";
import type { ProviderConnectionsState } from "@/lib/provider-connections/types";
import { api } from "@/trpc/react";
import type { Workspace } from "@oneglanse/db";
import {
	type AppMode,
	canAccessPeopleInMode,
	isInteractiveAuthAllowedInMode,
} from "@oneglanse/types";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	SidebarTrigger,
	toast,
} from "@oneglanse/ui";
import { cn } from "@oneglanse/utils";
import { ChevronUp, Loader2, User2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WorkspaceProvider } from "./workspace-context";

function getPageHeader(pathname: string | null): string | null {
	if (!pathname) return null;

	if (pathname.startsWith("/dashboard")) {
		return "Dashboard";
	}

	if (pathname.startsWith("/prompts")) {
		return "Prompts";
	}

	if (pathname.startsWith("/sources")) {
		return "Sources";
	}

	if (pathname.startsWith("/schedule")) {
		return "Schedule";
	}

	if (pathname.startsWith("/people")) {
		return "People";
	}

	if (pathname.startsWith("/providers")) {
		return "Providers";
	}

	if (pathname.startsWith("/settings")) {
		return "Settings";
	}

	if (pathname.startsWith("/workspace")) {
		return "Workspace";
	}

	return null;
}

function UserMenu({
	userName,
	userEmail,
}: {
	userName: string;
	userEmail: string;
}) {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);

	const handleLogout = async () => {
		setIsLoading(true);
		try {
			await signOutAndRedirect("/login");
			toast.success("Signed out successfully!");
		} catch {
			toast.error("Failed to sign out!");
			setIsLoading(false);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						formToolbarButtonClassName,
						"flex items-center gap-2 px-4",
					)}
				>
					<User2 className="h-4 w-4 shrink-0" />
					<span className="max-w-[140px] truncate">
						{userName || userEmail || "Account"}
					</span>
					<ChevronUp className="ml-auto h-4 w-4 shrink-0" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				side="bottom"
				align="end"
				sideOffset={8}
				className="min-w-0 rounded-[var(--app-radius)] border-transparent bg-white p-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_18px_-14px_rgba(15,23,42,0.12)] dark:bg-neutral-950 dark:shadow-[0_1px_2px_rgba(0,0,0,0.14),0_10px_24px_-16px_rgba(0,0,0,0.4)]"
				style={{ minWidth: "180px" }}
			>
				<div className="px-2 py-1.5">
					<p className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">
						{userName || "Account"}
					</p>
					<p className="truncate text-xs text-gray-500 dark:text-gray-400">
						{userEmail}
					</p>
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={() => void handleLogout()}>
					{isLoading ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<span>Sign out</span>
					)}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export default function LayoutContent({
	children,
	appMode,
	workspace,
	userName,
	userEmail,
	initialProviderConnections,
}: {
	children: React.ReactNode;
	appMode: AppMode;
	workspace: Workspace | null;
	userName: string;
	userEmail: string;
	initialProviderConnections: ProviderConnectionsState;
}) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSafeSearchParams();
	const isOnboardingFlow = pathname?.startsWith("/onboarding");
	const [hasSkippedProviderGate, setHasSkippedProviderGate] = useState(false);

	const workspaceIdFromUrl = searchParams.get("workspace") ?? "";

	const shouldFetchWorkspace =
		!!workspaceIdFromUrl && workspace?.id !== workspaceIdFromUrl;
	const workspaceQuery = api.workspace.getById.useQuery(
		{ workspaceId: workspaceIdFromUrl },
		{ enabled: shouldFetchWorkspace },
	);
	const authProvidersQuery = useProviderConnections({
		initialData: initialProviderConnections,
	});

	const resolvedWorkspace = workspaceQuery.data ?? workspace ?? null;
	const isResolvingWorkspaceFromUrl =
		shouldFetchWorkspace && !workspaceQuery.data && workspaceQuery.isFetching;
	const hasAtLeastOneConnection =
		authProvidersQuery.data?.cards.some((card) => card.status.connected) ??
		false;
	const canLaunchProvidersLocally = isInteractiveAuthAllowedInMode(appMode);
	const isProvidersPage = pathname === "/providers";
	const shouldEnforceProviderGate =
		!resolvedWorkspace && !isResolvingWorkspaceFromUrl;
	const isWorkspaceSetupPage = pathname?.startsWith("/workspace") ?? false;
	const isPeoplePage = pathname?.startsWith("/people") ?? false;
	const shouldShowConnectionGate =
		shouldEnforceProviderGate &&
		!hasSkippedProviderGate &&
		!isProvidersPage &&
		!isWorkspaceSetupPage;
	const pageHeader = getPageHeader(pathname);
	const providersWorkspaceId =
		workspaceIdFromUrl || resolvedWorkspace?.id || "";
	const rawNext = searchParams.get("next");
	const currentSearch = searchParams.toString();
	const currentPathWithQuery = pathname
		? `${pathname}${currentSearch ? `?${currentSearch}` : ""}`
		: "/workspace";
	const providerGateNext =
		rawNext ?? (isProvidersPage ? null : currentPathWithQuery);
	const providersParams = new URLSearchParams();
	if (providersWorkspaceId) {
		providersParams.set("workspace", providersWorkspaceId);
	}
	if (providerGateNext && canLaunchProvidersLocally) {
		providersParams.set("next", providerGateNext);
	}
	const providersNextHref = providerGateNext
		? getPostProvidersContinuePath({
				rawNext: providerGateNext,
				workspaceId: providersWorkspaceId || null,
			})
		: null;
	const workspaceHref = providersWorkspaceId
		? `/workspace?workspace=${providersWorkspaceId}`
		: "/workspace";
	const runToastManager = <ProviderRunToastManager />;

	useEffect(() => {
		setHasSkippedProviderGate(readSkipProviderGate());

		const handleSkipProviderGateChange = (event: Event) => {
			const nextValue =
				event instanceof CustomEvent && typeof event.detail?.value === "boolean"
					? event.detail.value
					: readSkipProviderGate();
			setHasSkippedProviderGate(nextValue);
		};

		window.addEventListener(
			SKIP_PROVIDER_GATE_EVENT,
			handleSkipProviderGateChange,
		);

		return () => {
			window.removeEventListener(
				SKIP_PROVIDER_GATE_EVENT,
				handleSkipProviderGateChange,
			);
		};
	}, []);

	useEffect(() => {
		if (!hasAtLeastOneConnection) {
			return;
		}

		writeSkipProviderGate(false);
		setHasSkippedProviderGate(false);
	}, [hasAtLeastOneConnection]);

	useEffect(() => {
		if (!canAccessPeopleInMode(appMode) && isPeoplePage) {
			router.replace(workspaceHref);
		}
	}, [appMode, isPeoplePage, router, workspaceHref]);

	useEffect(() => {
		if (
			!resolvedWorkspace &&
			!isResolvingWorkspaceFromUrl &&
			hasAtLeastOneConnection &&
			!isWorkspaceSetupPage &&
			!isProvidersPage &&
			!shouldShowConnectionGate
		) {
			router.replace("/workspace");
		}
	}, [
		hasAtLeastOneConnection,
		isResolvingWorkspaceFromUrl,
		isProvidersPage,
		isWorkspaceSetupPage,
		resolvedWorkspace,
		router,
		shouldShowConnectionGate,
	]);

	if (shouldShowConnectionGate) {
		return (
			<>
				{runToastManager}
				<main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
					<div className="fixed right-4 top-4 z-50">
						<UserMenu userName={userName} userEmail={userEmail} />
					</div>
					<ProvidersScreen
						title={
							canLaunchProvidersLocally
								? "Connect Providers"
								: "Providers are required"
						}
						description={
							canLaunchProvidersLocally
								? "Log in to any provider below, then close the browser window. Your auth is saved automatically, and you can continue as soon as one provider is active."
								: null
						}
						nextHref={providersNextHref}
						showOnboardingActions
						watchForExternalUpdates={!canLaunchProvidersLocally}
					/>
				</main>
			</>
		);
	}

	if (!resolvedWorkspace) {
		if (isResolvingWorkspaceFromUrl) {
			return (
				<>
					{runToastManager}
					<div className="web-app-shell">
						<main className="web-app-main bg-stone-50 dark:bg-neutral-950" />
					</div>
				</>
			);
		}

		return (
			<>
				{runToastManager}
				<div className="web-app-shell">
					<main className="web-app-main bg-stone-50 dark:bg-neutral-950">
						<div className="fixed right-4 top-4 z-50">
							<UserMenu userName={userName} userEmail={userEmail} />
						</div>
						<div className="web-app-scroll">{children}</div>
					</main>
				</div>
			</>
		);
	}

	if (isOnboardingFlow) {
		return (
			<>
				{runToastManager}
				<div className="web-app-shell">
					<main className="web-app-main">
						<div className="fixed right-4 top-4 z-50">
							<UserMenu userName={userName} userEmail={userEmail} />
						</div>
						<div className="web-app-scroll">{children}</div>
					</main>
				</div>
			</>
		);
	}

	return (
		<>
			{runToastManager}
			<WorkspaceProvider workspace={resolvedWorkspace} userEmail={userEmail}>
				<div className="web-app-shell">
					<AppSidebar
						appMode={appMode}
						workspace={resolvedWorkspace}
						userName={userName}
						userEmail={userEmail}
					/>
					<main className="web-app-main">
						{pageHeader ? (
							<header className="web-app-header">
								<SidebarTrigger className="size-8 shrink-0 rounded-none border-transparent bg-transparent p-0 shadow-none hover:bg-transparent dark:hover:bg-transparent" />
								<h1 className="truncate text-[0.95rem] font-medium tracking-[-0.01em] text-gray-950 dark:text-gray-50">
									{pageHeader}
								</h1>
							</header>
						) : null}
						<div className="web-app-scroll">{children}</div>
					</main>
				</div>
			</WorkspaceProvider>
		</>
	);
}
