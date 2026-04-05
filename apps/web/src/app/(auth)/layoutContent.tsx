// /app/LayoutContent.tsx (Client Component)
"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { ProviderConnectionsPanel } from "@/components/provider-connections-panel";
import { useSafeSearchParams } from "@/lib/navigation/use-safe-search-params";
import { useProviderConnections } from "@/lib/provider-connections/client";
import type { ProviderConnectionsState } from "@/lib/provider-connections/types";
import { api } from "@/trpc/react";
import type { Workspace } from "@oneglanse/db";
import {
	type AppMode,
	canRunPromptsNowInMode,
	isInteractiveAuthAllowedInMode,
} from "@oneglanse/types";
import { SidebarTrigger } from "@oneglanse/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { WorkspaceProvider } from "./workspace-context";

function getPageHeader(
	pathname: string | null,
	appMode: AppMode,
): string | null {
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
		return canRunPromptsNowInMode(appMode) ? "Run Prompts" : "Schedule";
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
	const shownJobsRef = useRef<Set<string>>(new Set());

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
	const shouldShowConnectionGate = !hasAtLeastOneConnection;
	const canLaunchProvidersLocally = isInteractiveAuthAllowedInMode(appMode);
	const isProvidersPage = pathname === "/providers";
	const isWorkspaceSetupPage = pathname?.startsWith("/workspace") ?? false;
	const pageHeader = getPageHeader(pathname, appMode);
	const providersWorkspaceId =
		workspaceIdFromUrl || resolvedWorkspace?.id || "";
	const providersHref = providersWorkspaceId
		? `/providers?workspace=${providersWorkspaceId}`
		: "/providers";

	useEffect(() => {
		if (
			shouldShowConnectionGate &&
			canLaunchProvidersLocally &&
			!isProvidersPage
		) {
			router.replace(providersHref);
		}
	}, [
		canLaunchProvidersLocally,
		isProvidersPage,
		providersHref,
		router,
		shouldShowConnectionGate,
	]);

	useEffect(() => {
		if (
			!resolvedWorkspace &&
			!isResolvingWorkspaceFromUrl &&
			hasAtLeastOneConnection &&
			!isWorkspaceSetupPage &&
			!isProvidersPage
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
	]);

	useEffect(() => {
		shownJobsRef.current.clear();
	});

	if (shouldShowConnectionGate) {
		return (
			<main className="mx-auto flex min-h-svh w-full max-w-6xl flex-col px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
				<div className="mb-10 max-w-3xl">
					<h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-gray-900 dark:text-gray-100">
						{canLaunchProvidersLocally
							? "Connect a provider"
							: "Providers are required"}
					</h1>
					<p className="mt-3 text-base leading-7 text-gray-500 dark:text-gray-400">
						{canLaunchProvidersLocally
							? "Log in to any provider below, then close the browser window. Your auth is saved automatically, and you can continue as soon as one provider is active."
							: "Provider auth can only be captured on a local run. Open the local app, connect at least one provider at /providers, then sync the saved auth back here before continuing."}
					</p>
				</div>

				{canLaunchProvidersLocally ? (
					<ProviderConnectionsPanel title={null} description={null} />
				) : null}
			</main>
		);
	}

	if (!resolvedWorkspace) {
		if (isResolvingWorkspaceFromUrl) {
			return (
				<div className="web-app-shell">
					<main className="web-app-main bg-stone-50 dark:bg-neutral-950" />
				</div>
			);
		}

		return (
			<div className="web-app-shell">
				<main className="web-app-main bg-stone-50 dark:bg-neutral-950">
					<div className="web-app-scroll">{children}</div>
				</main>
			</div>
		);
	}

	if (isOnboardingFlow) {
		return (
			<div className="web-app-shell">
				<main className="web-app-main">
					<div className="web-app-scroll">{children}</div>
				</main>
			</div>
		);
	}

	return (
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
	);
}
