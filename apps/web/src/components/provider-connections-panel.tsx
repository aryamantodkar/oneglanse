"use client";

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
		return "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950";
	}

	if (card.status.connecting) {
		return "border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900";
	}

	return "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950";
}

function getConnectionBadgeClasses(card: ProviderConnectionCard): string {
	if (card.status.connected) {
		return "border border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200";
	}

	if (card.status.connecting) {
		return "border border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200";
	}

	return "border border-gray-200 bg-white text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400";
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
				<div className="mb-8 max-w-2xl">
					{title ? (
						<h2 className="text-xl font-semibold tracking-[-0.02em] text-gray-900 dark:text-gray-100">
							{title}
						</h2>
					) : null}
					{description ? (
						<p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
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
					Interactive reconnect is available only on a local run. Open this
					Providers screen locally to capture or refresh auth, then sync it back
					here.
				</p>
			) : null}

			<div className="flex flex-col gap-6">
				{cards.map((card) => {
					const status = card.status;
					const {
						isPendingForProvider,
						isPendingConnect,
						isPendingRefresh,
					} = getCardMutationState({
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
					const primaryButtonLabel = status.connecting ? "Connecting" : "Connect";

					return (
						<div
							key={card.provider}
							className={cn(
								"group overflow-hidden rounded-2xl border px-4 py-4 transition-[border-color,background-color,box-shadow] duration-200 ease-out hover:border-gray-300 dark:hover:border-gray-700 sm:px-5 sm:py-4.5",
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

								<div className="flex items-center gap-2 sm:shrink-0">
									{statusLabel ? (
										<span
											className={cn(
												"inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium tracking-[0.02em]",
												getConnectionBadgeClasses(card),
											)}
										>
											{statusLabel}
										</span>
									) : null}
									{!isConnected ? (
										<Button
											variant="default"
											size="default"
											className="h-9 rounded-full px-4 text-sm shadow-none"
											onClick={() =>
												providerActionMutation.mutate({
													provider: card.provider,
													action: "connect",
												})
											}
											disabled={
												status.connecting ||
												isPendingForProvider ||
												!authProvidersQuery.data?.interactiveConnectAllowed
											}
										>
											{status.connecting || isPendingConnect ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : null}
											{primaryButtonLabel}
										</Button>
									) : null}

									{isConnected ? (
										<Button
											variant="ghost"
											size="icon"
											className="size-9 rounded-full border border-gray-200 bg-white text-gray-500 shadow-none hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-900"
											onClick={() =>
												providerActionMutation.mutate({
													provider: card.provider,
													action: "refresh",
												})
											}
											disabled={
												status.connecting ||
												isPendingForProvider ||
												!authProvidersQuery.data?.interactiveConnectAllowed
											}
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
						size="default"
						className="h-10 rounded-full px-5 text-sm shadow-none"
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
