"use client";

import {
	formDialogContentClassName,
	formDialogFooterClassName,
	formDialogHeaderClassName,
	formPanelClassName,
	formPrimaryButtonClassName,
	formSecondaryButtonClassName,
} from "@/components/forms/auth-form-chrome";
import {
	useProviderConnectionAction,
	useProviderConnections,
	useResetAllProviders,
} from "@/lib/provider-connections/client";
import { writeSkipProviderGate } from "@/lib/provider-connections/provider-gate";
import type { ProviderConnectionCard } from "@/lib/provider-connections/types";
import { api } from "@/trpc/react";
import { AUTH_PROVIDER_LIST } from "@oneglanse/types";
import type { AuthProvider } from "@oneglanse/types";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	toast,
} from "@oneglanse/ui";
import { cn, getModelFavicon } from "@oneglanse/utils";
import {
	ArrowRight,
	CheckCircle2,
	Loader2,
	RotateCcw,
	RotateCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const CARD_ORDER: Array<ProviderConnectionCard["provider"]> = [
	"google",
	"gemini",
	"chatgpt",
	"perplexity",
	"claude",
];

function getConnectionCardTitle(card: ProviderConnectionCard): string {
	return card.provider === "google" ? "AI Overview" : card.displayName;
}

function sortConnectionCards(
	cards: ProviderConnectionCard[],
): ProviderConnectionCard[] {
	return [...cards].sort((left, right) => {
		const leftIndex = CARD_ORDER.indexOf(left.provider);
		const rightIndex = CARD_ORDER.indexOf(right.provider);
		const normalizedLeftIndex =
			leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
		const normalizedRightIndex =
			rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

		if (normalizedLeftIndex !== normalizedRightIndex) {
			return normalizedLeftIndex - normalizedRightIndex;
		}

		return getConnectionCardTitle(left).localeCompare(
			getConnectionCardTitle(right),
		);
	});
}

function getConnectionStatusLabel(card: ProviderConnectionCard): string {
	if (card.status.connecting) {
		return "Connecting";
	}

	return card.status.connected ? "" : "Disconnected";
}

function getConnectionStatusMessage(
	card: ProviderConnectionCard,
): string | null {
	if (card.status.connecting) {
		return "Finish the sign-in flow and close the provider browser window to activate this provider.";
	}

	if (!card.status.connected) {
		return null;
	}

	return card.status.error;
}

function formatConnectionUpdatedAt(timestamp: string | null): string | null {
	if (!timestamp) {
		return null;
	}

	return new Date(timestamp).toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	});
}

function getConnectionCardClasses(card: ProviderConnectionCard): string {
	if (card.status.connecting) {
		return `${formPanelClassName} border-gray-200/40 bg-stone-50 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.18)] dark:border-white/5 dark:bg-neutral-900 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.55)]`;
	}

	return `${formPanelClassName} border-gray-200/40 bg-white shadow-[0_20px_60px_-32px_rgba(15,23,42,0.18)] dark:border-white/5 dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.55)]`;
}

function getConnectionBadgeClasses(card: ProviderConnectionCard): string {
	if (card.status.connecting) {
		return "border border-gray-200/80 bg-stone-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200";
	}

	return "border border-gray-200/80 bg-white text-gray-500 dark:border-gray-800 dark:bg-neutral-950 dark:text-gray-400";
}

function getCardMutationState(args: {
	card: ProviderConnectionCard;
	isMutationPending: boolean;
	variables: ReturnType<typeof useProviderConnectionAction>["variables"];
}) {
	const { card, isMutationPending, variables } = args;
	const isPendingForProvider =
		isMutationPending && variables?.provider === card.provider;

	return {
		isPendingForProvider,
		isPendingConnect:
			isPendingForProvider && (variables?.action ?? "connect") === "connect",
		isPendingRefresh: isPendingForProvider && variables?.action === "refresh",
	};
}

export function ProviderConnectionsPanel(props: {
	title?: string | null;
	description?: string | null;
	nextHref?: string | null;
	showSetupNotice?: boolean;
	workspaceId?: string | null;
	showOnboardingActions?: boolean;
	watchForExternalUpdates?: boolean;
}) {
	const {
		title = "Providers",
		description = "Log in to a provider, then close the browser window. Auth is saved automatically.",
		nextHref = null,
		showSetupNotice = true,
		workspaceId = null,
		showOnboardingActions = false,
		watchForExternalUpdates = false,
	} = props;
	const router = useRouter();
	const authProvidersQuery = useProviderConnections({
		watchForExternalUpdates,
	});
	const resolvedWorkspaceId = workspaceId ?? "";

	const enabledProvidersQuery = api.workspace.getEnabledProviders.useQuery(
		{ workspaceId: resolvedWorkspaceId },
		{ enabled: !!workspaceId },
	);

	// Local state for instant toggle feedback — synced from server on first load
	const [localEnabled, setLocalEnabled] = useState<
		AuthProvider[] | null | undefined
	>(undefined);
	const [showSkipDialog, setShowSkipDialog] = useState(false);
	const toggleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		if (
			localEnabled === undefined &&
			enabledProvidersQuery.data !== undefined &&
			!enabledProvidersQuery.isFetching
		) {
			setLocalEnabled(enabledProvidersQuery.data.enabledProviders ?? null);
		}
	}, [
		enabledProvidersQuery.data,
		enabledProvidersQuery.isFetching,
		localEnabled,
	]);

	const utils = api.useUtils();
	const setEnabledMutation = api.workspace.setEnabledProviders.useMutation({
		onSuccess: () => {
			if (!workspaceId) {
				return;
			}

			void utils.workspace.getEnabledProviders.invalidate({
				workspaceId,
			});
		},
		onError: () => {
			// Revert to server state on error
			setLocalEnabled(enabledProvidersQuery.data?.enabledProviders ?? null);
			toast.error("Failed to update provider. Please try again.");
		},
	});

	const isProviderEnabled = (provider: AuthProvider): boolean => {
		const state =
			localEnabled !== undefined
				? localEnabled
				: (enabledProvidersQuery.data?.enabledProviders ?? null);
		return state === null || state.includes(provider);
	};

	const handleProviderToggle = (provider: AuthProvider) => {
		if (!workspaceId) return;
		const currentState =
			localEnabled !== undefined
				? localEnabled
				: (enabledProvidersQuery.data?.enabledProviders ?? null);
		const currentList =
			currentState === null
				? ([...AUTH_PROVIDER_LIST] as AuthProvider[])
				: currentState;
		const currentlyEnabled =
			currentState === null || currentState.includes(provider);

		let next: AuthProvider[] | null;
		if (currentlyEnabled) {
			const remaining = currentList.filter((p) => p !== provider);
			next = remaining as AuthProvider[];
		} else {
			const nextList = [...currentList, provider] as AuthProvider[];
			next = nextList.length === AUTH_PROVIDER_LIST.length ? null : nextList;
		}

		setLocalEnabled(next);

		if (toggleDebounceRef.current) clearTimeout(toggleDebounceRef.current);
		toggleDebounceRef.current = setTimeout(() => {
			setEnabledMutation.mutate({ workspaceId, enabledProviders: next });
		}, 300);
	};

	const providerActionMutation = useProviderConnectionAction({
		onSuccess: (result, variables) => {
			toast.success(
				result.started
					? variables.action === "refresh"
						? "Connection flow restarted on this machine."
						: "Connection flow started on this machine."
					: "Connection flow is already running.",
			);
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});
	const resetAllMutation = useResetAllProviders({
		onSuccess: () => {
			toast.success("All provider sessions have been reset.");
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});
	const cards = sortConnectionCards(authProvidersQuery.data?.cards ?? []);
	const hasAtLeastOneConnection = cards.some((card) => card.status.connected);
	const isAnyConnectionPending =
		providerActionMutation.isPending ||
		cards.some((card) => card.status.connecting);

	const handleSkipForNow = () => {
		writeSkipProviderGate(true);
		setShowSkipDialog(false);
		router.push(nextHref ?? "/workspace");
	};

	const canInteractivelyConnect =
		authProvidersQuery.data?.interactiveConnectAllowed ?? true;
	const shouldShowExternalContinueAction =
		showOnboardingActions &&
		!canInteractivelyConnect &&
		!hasAtLeastOneConnection;

	return (
		<section>
			<div className="mb-6 space-y-2">
				<div className="space-y-2">
					<div className="flex flex-wrap items-center gap-3">
						{title ? (
							<h2 className="text-[1.45rem] font-semibold leading-tight tracking-[-0.03em] text-gray-950 sm:text-[1.8rem] dark:text-gray-50">
								{title}
							</h2>
						) : null}
						<Button
							variant="ghost"
							className={cn(
								formSecondaryButtonClassName,
								"h-10 shrink-0 border border-red-200 bg-red-50 text-red-700 shadow-none hover:bg-red-100 hover:text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950/60 dark:hover:text-red-100",
							)}
							onClick={() => resetAllMutation.mutate()}
							disabled={
								!hasAtLeastOneConnection ||
								resetAllMutation.isPending ||
								isAnyConnectionPending
							}
							title="Reset all provider sessions"
						>
							{resetAllMutation.isPending ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<RotateCcw className="h-3.5 w-3.5" />
							)}
							Reset all
						</Button>
					</div>
					{description ? (
						<p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
							{description}
						</p>
					) : null}
				</div>
			</div>

			{authProvidersQuery.isLoading ? (
				<div className="mb-6 flex items-center gap-2 rounded-[var(--app-radius)] border border-gray-200/80 px-4 py-3 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading providers...
				</div>
			) : null}

			{authProvidersQuery.error ? (
				<p className="mb-6 rounded-[var(--app-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
					{authProvidersQuery.error.message}
				</p>
			) : null}

			{showSetupNotice && !canInteractivelyConnect ? (
				<p className="mb-6 rounded-[var(--app-radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
					To connect or refresh providers, run{" "}
					<code className="rounded px-1 font-mono text-xs">pnpm auth</code> on
					your local machine, finish sign-in on the local{" "}
					<code className="rounded px-1 font-mono text-xs">
						/providers/local
					</code>{" "}
					page, then upload the saved sessions to this VPS.{" "}
					{watchForExternalUpdates
						? "This page updates automatically as soon as uploaded sessions are detected."
						: "Refresh this page after the upload completes to see the updated provider status."}
				</p>
			) : null}

			<div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start lg:gap-3">
				{cards.map((card) => {
					const status = card.status;
					const { isPendingForProvider, isPendingConnect, isPendingRefresh } =
						getCardMutationState({
							card,
							isMutationPending: providerActionMutation.isPending,
							variables: providerActionMutation.variables,
						});
					const isConnected = status.connected;
					const primaryProvider = card.providers[0] ?? card.provider;
					const cardTitle = getConnectionCardTitle(card);
					const statusLabel = getConnectionStatusLabel(card);
					const statusMessage = getConnectionStatusMessage(card);
					const updatedAtLabel = formatConnectionUpdatedAt(
						status.lastUpdatedAt,
					);
					const canInteractivelyReconnect = Boolean(
						authProvidersQuery.data?.interactiveConnectAllowed,
					);
					const primaryButtonLabel = status.connecting
						? "Connecting"
						: "Connect";

					const isEnabled = isProviderEnabled(card.provider);

					return (
						<div
							key={card.provider}
							className={cn(
								"group relative overflow-hidden px-4 py-4 transition-[background-color,box-shadow,border-color] duration-200 ease-out sm:px-5 sm:py-5",
								getConnectionCardClasses(card),
							)}
						>
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div
									className={cn(
										"min-w-0 flex-1 transition-opacity duration-200",
										!isEnabled && workspaceId ? "opacity-40" : "opacity-100",
									)}
								>
									<div className="flex items-center gap-3">
										<img
											src={getModelFavicon(primaryProvider)}
											alt={cardTitle}
											className="h-6 w-6 shrink-0 rounded-[var(--app-radius)] sm:h-7 sm:w-7"
										/>

										<div className="min-w-0">
											<div className="flex flex-col gap-1">
												<span className="text-[10px] font-medium uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
													Provider
												</span>
												<p className="truncate text-sm font-semibold tracking-[-0.02em] text-gray-900 dark:text-gray-100">
													{cardTitle}
												</p>
											</div>
											{isConnected && !statusMessage ? (
												<div className="mt-1.5 space-y-1">
													<div className="flex flex-wrap items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
														<CheckCircle2 className="h-3.5 w-3.5" />
														Ready for prompt runs
													</div>
													{updatedAtLabel ? (
														<p className="text-[11px] leading-4.5 text-gray-500 dark:text-gray-400">
															Updated {updatedAtLabel}
														</p>
													) : null}
												</div>
											) : null}
											{statusMessage ? (
												<p className="mt-1 text-[11px] leading-4.5 text-gray-500 dark:text-gray-400">
													{statusMessage}
												</p>
											) : null}
										</div>
									</div>
								</div>

								<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
									{statusLabel ? (
										<span
											className={cn(
												"inline-flex items-center rounded-[var(--app-radius)] px-3 py-1 text-[10px] font-medium tracking-[0.02em]",
												getConnectionBadgeClasses(card),
											)}
										>
											{statusLabel}
										</span>
									) : null}
									{canInteractivelyReconnect && !isConnected ? (
										<Button
											variant="default"
											className={cn(
												formPrimaryButtonClassName,
												"h-11 w-full shrink-0 px-5 sm:w-auto",
											)}
											onClick={() =>
												providerActionMutation.mutate({
													provider: card.provider,
													action: "connect",
												})
											}
											disabled={status.connecting || isPendingForProvider}
										>
											{status.connecting || isPendingConnect ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : null}
											{primaryButtonLabel}
										</Button>
									) : null}

									{canInteractivelyReconnect && isConnected ? (
										<Button
											variant="ghost"
											size="icon"
											className={cn(
												formSecondaryButtonClassName,
												"size-9 shrink-0 border border-gray-200/80 p-0 text-gray-500 dark:border-gray-700 dark:text-gray-300",
											)}
											onClick={() =>
												providerActionMutation.mutate({
													provider: card.provider,
													action: "refresh",
												})
											}
											disabled={status.connecting || isPendingForProvider}
											aria-label={`Reconnect ${cardTitle}`}
											title={`Reconnect ${cardTitle}`}
										>
											{status.connecting || isPendingRefresh ? (
												<Loader2 className="h-3.5 w-3.5 animate-spin" />
											) : (
												<RotateCw className="h-3.5 w-3.5" />
											)}
										</Button>
									) : null}

									{workspaceId && isConnected ? (
										<div className="ml-0.5 flex items-center gap-2">
											<button
												type="button"
												role="switch"
												aria-checked={isEnabled}
												onClick={() => handleProviderToggle(card.provider)}
												disabled={setEnabledMutation.isPending}
												title={
													isEnabled
														? `Disable ${cardTitle}`
														: `Enable ${cardTitle}`
												}
												className={cn(
													"relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none disabled:cursor-not-allowed",
													isEnabled
														? "bg-emerald-500 dark:bg-emerald-600"
														: "bg-gray-200 dark:bg-gray-700",
												)}
											>
												<span
													className={cn(
														"pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
														isEnabled ? "translate-x-4" : "translate-x-0",
													)}
												/>
											</button>
										</div>
									) : null}
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{showOnboardingActions ? (
				<div className="mt-6 flex items-center justify-end gap-3">
					{hasAtLeastOneConnection && nextHref ? (
						<Button
							variant="ghost"
							className={cn(
								formSecondaryButtonClassName,
								"h-11 w-auto gap-2 border border-gray-200/80 px-5 text-sm font-medium dark:border-gray-700",
							)}
							onClick={() => router.push(nextHref)}
							disabled={isAnyConnectionPending}
						>
							Next
							<ArrowRight className="h-4 w-4" />
						</Button>
					) : null}
					{shouldShowExternalContinueAction ? (
						<Button
							onClick={handleSkipForNow}
							disabled={isAnyConnectionPending}
							className={cn(formPrimaryButtonClassName, "h-11 w-auto px-5")}
						>
							OK, understood
						</Button>
					) : nextHref ? (
						<Button
							variant="ghost"
							onClick={() => setShowSkipDialog(true)}
							disabled={isAnyConnectionPending}
							className={cn(
								formSecondaryButtonClassName,
								"h-10 w-auto border border-gray-200/80 px-3.5 text-[11px] dark:border-gray-700",
							)}
						>
							Skip for now
						</Button>
					) : null}
				</div>
			) : null}

			<Dialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
				<DialogContent className={formDialogContentClassName}>
					<DialogHeader className={formDialogHeaderClassName}>
						<DialogTitle className="text-lg font-semibold tracking-[-0.01em] text-gray-950 dark:text-gray-50">
							Continue without providers?
						</DialogTitle>
						<DialogDescription className="text-sm leading-6 text-gray-500 dark:text-gray-400">
							You can keep setting up your workspace, but prompt runs will not
							work until at least one provider is connected.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className={formDialogFooterClassName}>
						<Button
							variant="ghost"
							onClick={() => setShowSkipDialog(false)}
							className={formSecondaryButtonClassName}
						>
							No
						</Button>
						<Button
							onClick={handleSkipForNow}
							className={formPrimaryButtonClassName}
						>
							Yes, continue anyway
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}
