// /app/LayoutContent.tsx (Client Component)
"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { ProviderConnectionsPanel } from "@/components/provider-connections-panel";
import { useSafeSearchParams } from "@/lib/navigation/use-safe-search-params";
import { useProviderConnections } from "@/lib/provider-connections/client";
import type { ProviderConnectionsState } from "@/lib/provider-connections/types";
import { api } from "@/trpc/react";
import type { Workspace } from "@oneglanse/db";
import { type AppMode, isInteractiveAuthAllowedInMode } from "@oneglanse/types";
import { SidebarTrigger } from "@oneglanse/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { WorkspaceProvider } from "./workspace-context";

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
	const pageTitle = pathname?.split("/").filter(Boolean).pop() || "Home";
	const capitalizedTitle =
		pageTitle.charAt(0).toUpperCase() + pageTitle.slice(1);
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
			<main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-6 py-14 sm:px-8">
				<div className="mb-12 max-w-3xl">
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
					<main className="web-app-main">
						<div className="flex items-center justify-between border-b border-gray-200 p-2 transition-[background-color,border-color] duration-200">
							<div className="flex items-center gap-3">
								<h1 className="text-sm font-semibold text-gray-900">
									Loading Workspace
								</h1>
							</div>
						</div>
					</main>
				</div>
			);
		}

		return (
			<div className="web-app-shell">
				<main className="web-app-main">
					<div className="flex items-center justify-between border-b border-gray-200 p-2 transition-[background-color,border-color] duration-200">
						<div className="flex items-center gap-3">
							<h1 className="text-sm font-semibold text-gray-900">
								Workspace Setup
							</h1>
						</div>
					</div>
					<div className="web-app-scroll px-4 sm:px-6">{children}</div>
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
					<div className="flex items-center justify-between border-b border-gray-200 p-2 transition-[background-color,border-color] duration-200">
						<div className="flex items-center gap-3">
							<SidebarTrigger className="text-gray-700 transition-colors duration-200 hover:text-gray-900" />
							<h1 className="text-sm font-semibold text-gray-900">
								{capitalizedTitle}
							</h1>
						</div>
					</div>

					{/* Page content */}
					<div className="web-app-scroll px-4 sm:px-6">{children}</div>
				</main>
			</div>
		</WorkspaceProvider>
	);
}
