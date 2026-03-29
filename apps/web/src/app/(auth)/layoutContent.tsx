// /app/LayoutContent.tsx (Client Component)
"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { api } from "@/trpc/react";
import type { Workspace } from "@oneglanse/db";
import { SidebarTrigger } from "@oneglanse/ui";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { WorkspaceProvider } from "./workspace-context";

export default function LayoutContent({
	children,
	isSelfHosted,
	workspace,
	userName,
	userEmail,
}: {
	children: React.ReactNode;
	isSelfHosted: boolean;
	workspace: Workspace | null;
	userName: string;
	userEmail: string;
}) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
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

	const resolvedWorkspace = workspaceQuery.data ?? workspace ?? null;

	useEffect(() => {
		shownJobsRef.current.clear();
	}, [resolvedWorkspace?.id]);

	if (!resolvedWorkspace) {
		return (
			<div className="ui-page-enter flex min-h-svh w-full min-w-0 overflow-x-hidden">
				<main className="flex min-w-0 flex-1 flex-col min-h-0 overflow-x-hidden">
					{/* Header */}
					<div className="flex items-center justify-between border-b border-gray-200 p-2 transition-[background-color,border-color] duration-200">
						<div className="flex items-center gap-3">
							<h1 className="text-sm font-semibold text-gray-900">
								Workspace Setup
							</h1>
						</div>
					</div>

					{/* Page content */}
					<div className="ui-page-enter flex-1 min-h-0 min-w-0 overflow-auto overflow-x-hidden px-4 sm:px-6">
						{children}
					</div>
				</main>
			</div>
		);
	}

	if (isOnboardingFlow) {
		return (
			<div className="ui-page-enter flex min-h-svh w-full min-w-0 overflow-x-hidden">
				<main className="flex min-w-0 flex-1 flex-col min-h-0 overflow-x-hidden">
					<div className="ui-page-enter flex-1 min-h-0 min-w-0 overflow-auto overflow-x-hidden">
						{children}
					</div>
				</main>
			</div>
		);
	}

	return (
		<WorkspaceProvider workspace={resolvedWorkspace} userEmail={userEmail}>
			<div className="ui-page-enter flex min-h-svh w-full min-w-0 overflow-x-hidden">
				<AppSidebar
					isSelfHosted={isSelfHosted}
					workspace={resolvedWorkspace}
					userName={userName}
					userEmail={userEmail}
				/>
				<main className="flex min-w-0 flex-1 flex-col min-h-0 overflow-x-hidden">
					<div className="flex items-center justify-between border-b border-gray-200 p-2 transition-[background-color,border-color] duration-200">
						<div className="flex items-center gap-3">
							<SidebarTrigger className="text-gray-700 transition-colors duration-200 hover:text-gray-900" />
							<h1 className="text-sm font-semibold text-gray-900">
								{capitalizedTitle}
							</h1>
						</div>
					</div>

					{/* Page content */}
					<div className="ui-page-enter flex-1 min-h-0 min-w-0 overflow-auto overflow-x-hidden px-4 sm:px-6">
						{children}
					</div>
				</main>
			</div>
		</WorkspaceProvider>
	);
}
