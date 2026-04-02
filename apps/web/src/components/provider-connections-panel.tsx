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
		return "border-emerald-200/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(255,255,255,0.97))] shadow-[0_22px_48px_-34px_rgba(16,185,129,0.45)] dark:border-emerald-900/50 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.34),rgba(3,7,18,0.94))]";
	}

	if (card.status.connecting) {
		return "border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.97))] shadow-[0_22px_48px_-34px_rgba(245,158,11,0.4)] dark:border-amber-900/50 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.3),rgba(3,7,18,0.94))]";
	}

	return "border-gray-200/90 bg-[linear-gradient(135deg,rgba(255,255,255,0.99),rgba(248,250,252,0.96))] shadow-[0_22px_48px_-38px_rgba(15,23,42,0.26)] dark:border-gray-800 dark:bg-[linear-gradient(135deg,rgba(17,24,39,0.98),rgba(3,7,18,0.95))]";
}

function getConnectionBadgeClasses(card: ProviderConnectionCard): string {
	if (card.status.connected) {
		return "border border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300";
	}

	if (card.status.connecting) {
		return "border border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300";
	}

	return "border border-gray-200/80 bg-white/85 text-gray-600 dark:border-gray-800 dark:bg-white/5 dark:text-gray-300";
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
								"group overflow-hidden rounded-[30px] border px-6 py-6 transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 sm:px-8 sm:py-7",
								getConnectionCardClasses(card),
							)}
						>
							<div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-4">
										<img
											src={getModelFavicon(primaryProvider)}
											alt={cardTitle}
											className="h-8 w-8 shrink-0 rounded-md sm:h-9 sm:w-9"
										/>

										<div className="min-w-0">
											<div className="flex flex-col gap-2">
												<span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
													Provider
												</span>
												<p className="truncate text-xl font-semibold tracking-[-0.03em] text-gray-900 dark:text-gray-100">
													{cardTitle}
												</p>
											</div>
											{status.error ? (
												<p className="mt-2 text-sm leading-6 text-red-500 dark:text-red-300">
													{status.error}
												</p>
											) : null}
										</div>
									</div>
								</div>

								<div className="flex items-center gap-2.5 sm:shrink-0">
									{statusLabel ? (
										<span
											className={cn(
												"inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.03em]",
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
											className="h-11 rounded-full px-5 text-sm shadow-none"
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
											className="size-11 rounded-full border border-gray-200/80 bg-white/70 text-gray-500 shadow-none hover:border-gray-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
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
				<div className="mt-8 flex justify-end">
					<Button
						variant="default"
						size="default"
						className="h-12 rounded-full px-6 text-sm shadow-none"
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
