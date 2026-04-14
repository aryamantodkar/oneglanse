"use client";

import {
	formPanelClassName,
	formPrimaryButtonClassName,
	formSecondaryButtonClassName,
} from "@/components/forms/auth-form-chrome";
import {
	useProviderConnectionAction,
	useProviderConnections,
} from "@/lib/provider-connections/client";
import type { ProviderConnectionCard } from "@/lib/provider-connections/types";
import { Button, toast } from "@oneglanse/ui";
import { cn, getModelFavicon } from "@oneglanse/utils";
import { Loader2, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";

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

function getConnectionStatusLabel(
	card: ProviderConnectionCard,
	remoteSyncConfigured: boolean | undefined,
): string {
	if (card.status.connecting) {
		return "Connecting";
	}

	if (card.status.synced) {
		return remoteSyncConfigured ? "Synced" : "Connected";
	}

	return card.status.connected ? "Saved locally" : "";
}

function getConnectionCardClasses(card: ProviderConnectionCard): string {
	if (card.status.connected) {
		return `${formPanelClassName} bg-white shadow-[0_20px_60px_-32px_rgba(15,23,42,0.18)] hover:shadow-[0_20px_60px_-28px_rgba(15,23,42,0.22)] dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.55)] dark:hover:shadow-[0_20px_60px_-28px_rgba(0,0,0,0.62)]`;
	}

	if (card.status.connecting) {
		return `${formPanelClassName} bg-stone-50 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.18)] hover:shadow-[0_20px_60px_-28px_rgba(15,23,42,0.22)] dark:bg-neutral-900 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.55)] dark:hover:shadow-[0_20px_60px_-28px_rgba(0,0,0,0.62)]`;
	}

	return `${formPanelClassName} bg-white shadow-[0_20px_60px_-32px_rgba(15,23,42,0.18)] hover:shadow-[0_20px_60px_-28px_rgba(15,23,42,0.22)] dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.55)] dark:hover:shadow-[0_20px_60px_-28px_rgba(0,0,0,0.62)]`;
}

function getConnectionBadgeClasses(card: ProviderConnectionCard): string {
	if (card.status.connected) {
		return "border border-gray-200/80 bg-stone-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200";
	}

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
}) {
	const {
		title = "Providers",
		description = "Log in to a provider, then close the browser window. Auth is saved automatically.",
		nextHref = null,
	} = props;
	const router = useRouter();
	const authProvidersQuery = useProviderConnections();
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
	const cards = sortConnectionCards(authProvidersQuery.data?.cards ?? []);
	const hasAtLeastOneConnection = cards.some((card) => card.status.connected);
	const isAnyConnectionPending =
		providerActionMutation.isPending ||
		cards.some((card) => card.status.connecting);

	return (
		<section>
			{title || description ? (
				<div className="mb-6 max-w-2xl space-y-1.5">
					{title ? (
						<h2 className="text-xl font-semibold tracking-[-0.025em] text-gray-900 dark:text-gray-100">
							{title}
						</h2>
					) : null}
					{description ? (
						<p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
							{description}
						</p>
					) : null}
				</div>
			) : null}

			{authProvidersQuery.isLoading ? (
				<div className="mb-6 flex items-center gap-2 rounded-2xl border border-gray-200/80 px-4 py-3 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading providers...
				</div>
			) : null}

			{authProvidersQuery.error ? (
				<p className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
					{authProvidersQuery.error.message}
				</p>
			) : null}

			{!authProvidersQuery.data?.interactiveConnectAllowed ? (
				<p className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
					To connect or refresh providers, run{" "}
					<code className="rounded px-1 font-mono text-xs">pnpm auth</code> on
					your local machine, then finish sign-in on the local{" "}
					<code className="rounded px-1 font-mono text-xs">/providers</code>{" "}
					page. Sessions are uploaded to your VPS automatically.
				</p>
			) : null}

			<div className="flex flex-col gap-4">
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
					const statusLabel = getConnectionStatusLabel(
						card,
						authProvidersQuery.data?.remoteSyncConfigured,
					);
					const canInteractivelyReconnect = Boolean(
						authProvidersQuery.data?.interactiveConnectAllowed,
					);
					const primaryButtonLabel = status.connecting
						? "Connecting"
						: "Connect";

					return (
						<div
							key={card.provider}
							className={cn(
								"group overflow-hidden px-5 py-5 transition-[background-color,box-shadow] duration-200 ease-out sm:px-6 sm:py-5",
								getConnectionCardClasses(card),
							)}
						>
							<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-3">
										<img
											src={getModelFavicon(primaryProvider)}
											alt={cardTitle}
											className="h-7 w-7 shrink-0 rounded-md sm:h-8 sm:w-8"
										/>

										<div className="min-w-0">
											<div className="flex flex-col gap-1">
												<span className="text-[10px] font-medium uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
													Provider
												</span>
												<p className="truncate text-base font-semibold tracking-[-0.02em] text-gray-900 dark:text-gray-100">
													{cardTitle}
												</p>
											</div>
											{status.error ? (
												<p className="mt-1.5 text-sm leading-5 text-red-500 dark:text-red-300">
													{status.error}
												</p>
											) : null}
										</div>
									</div>
								</div>

								<div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
									{statusLabel ? (
										<span
											className={cn(
												"inline-flex items-center rounded-[24px] px-3 py-1 text-[10px] font-medium tracking-[0.02em]",
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
												"size-11 rounded-[24px] p-0 text-gray-500 dark:text-gray-300",
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
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<RotateCw className="h-4 w-4" />
											)}
										</Button>
									) : null}
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{nextHref && hasAtLeastOneConnection ? (
				<div className="mt-6 flex justify-end">
					<Button
						variant="default"
						className={cn(formPrimaryButtonClassName, "h-11 w-auto px-5")}
						onClick={() => router.push(nextHref)}
						disabled={isAnyConnectionPending}
					>
						Next
					</Button>
				</div>
			) : null}
		</section>
	);
}
