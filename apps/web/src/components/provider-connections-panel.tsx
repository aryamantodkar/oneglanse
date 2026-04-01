"use client";

import {
	useProviderConnectionAction,
	useProviderConnections,
} from "@/lib/provider-connections/client";
import { Button, toast } from "@oneglanse/ui";
import { getModelFavicon, getProviderDisplayName } from "@oneglanse/utils";
import { CheckCircle2, Loader2, RotateCw } from "lucide-react";

export function ProviderConnectionsPanel(props: {
	title?: string;
	description?: string;
}) {
	const { title = "Provider Connections", description } = props;
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

	return (
		<section>
			<div className="mb-4 flex items-center gap-2">
				<h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
					{title}
				</h2>
			</div>

			<div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
				<p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
					{description ??
						"Each provider group uses a portable auth bundle plus a persistent Camoufox runtime profile. Start the local sign-in flow for any missing connection."}
				</p>
				{authProvidersQuery.isLoading ? (
					<div className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
						<Loader2 className="h-4 w-4 animate-spin" />
						Loading provider connections...
					</div>
				) : null}
				{authProvidersQuery.error ? (
					<p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
						{authProvidersQuery.error.message}
					</p>
				) : null}
				{!authProvidersQuery.data?.interactiveConnectAllowed ? (
					<p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
						Interactive sign-in is disabled in this environment. Open this same
						screen on your local machine to capture sessions and sync them here.
					</p>
				) : null}
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					{(authProvidersQuery.data?.cards ?? []).map((card) => {
						const status = card.status;
						const currentAction = providerActionMutation.variables;
						const isPendingForProvider =
							providerActionMutation.isPending &&
							currentAction?.provider === card.provider;
						const isPendingConnect =
							isPendingForProvider &&
							(currentAction?.action ?? "connect") === "connect";
						const isPendingRefresh =
							isPendingForProvider &&
							currentAction?.action === "refresh";
						const isConnected = status.connected;
						const isSynced = status.synced;
						const primaryProvider = card.providers[0] ?? card.provider;
						const description = card.providers
							.map((provider) => getProviderDisplayName(provider))
							.join(", ");
						const badgeLabel = isConnected
							? isSynced
								? authProvidersQuery.data?.remoteSyncConfigured
									? "Synced"
									: "Connected"
								: "Saved locally"
							: null;

						return (
							<div
								key={card.provider}
								className="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
							>
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<div className="flex items-center gap-3">
											<img
												src={getModelFavicon(primaryProvider)}
												alt={card.displayName}
												className="h-5 w-5 rounded-sm"
											/>
											<div>
												<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
													{card.displayName}
												</p>
												<p className="text-xs text-gray-500 dark:text-gray-400">
													Used by {description}
												</p>
											</div>
										</div>
										<p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
											{card.domain}
										</p>
										{status.lastUpdatedAt ? (
											<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
												Last updated{" "}
												{new Date(status.lastUpdatedAt).toLocaleString()}
											</p>
										) : null}
										{status.syncedAt &&
										authProvidersQuery.data?.remoteSyncConfigured ? (
											<p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
												Synced to VPS{" "}
												{new Date(status.syncedAt).toLocaleString()}
											</p>
										) : null}
										{status.error ? (
											<p className="mt-2 text-xs text-red-500">
												{status.error}
											</p>
										) : null}
									</div>
									{isConnected ? (
										<div className="flex flex-col items-end gap-2">
											<div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
												<CheckCircle2 className="h-4 w-4" />
												{badgeLabel}
											</div>
											<Button
												variant="outline"
												size="sm"
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
											>
												{status.connecting || isPendingRefresh ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<RotateCw className="h-4 w-4" />
												)}
												Reconnect
											</Button>
										</div>
									) : (
										<Button
											variant="outline"
											onClick={() =>
												providerActionMutation.mutate({
													provider: card.provider,
													action: "connect",
												})
											}
											disabled={
												status.connecting ||
												isPendingConnect ||
												!authProvidersQuery.data?.interactiveConnectAllowed
											}
										>
											{status.connecting || isPendingConnect ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : null}
											{card.connectLabel}
										</Button>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}
