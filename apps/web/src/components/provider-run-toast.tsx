"use client";

import { useSafeSearchParams } from "@/lib/navigation/use-safe-search-params";
import { api } from "@/trpc/react";
import { PROVIDER_LIST, type Provider } from "@oneglanse/types";
import { ProviderRunStatusCard, toast } from "@oneglanse/ui";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProviderState = "pending" | "running" | "completed" | "failed" | "stopped";

type ProviderProgressResponse = {
	updateId?: number;
	providers?: Record<string, ProviderState>;
	results?: Record<string, number>;
	stats?: { totalPrompts?: number };
};

type DisplayPhase = "pending" | "running" | "completed" | "failed" | "stopped";

const PROVIDER_RUN_TOAST_ID = "provider-run-progress";
const COMPLETION_TOAST_DURATION_MS = 1400;
const STOPPED_HANDOFF_DELAY_MS = 350;
const ACTIVE_PROVIDER_RUN_STORAGE_KEY = "oneglanse.active-provider-run";
const ACTIVE_PROVIDER_RUN_EVENT = "oneglanse:active-provider-run";

type ActiveProviderRun = {
	workspaceId: string;
	jobId: string;
};

function readActiveProviderRun(): ActiveProviderRun | null {
	if (typeof window === "undefined") return null;
	const raw = window.localStorage.getItem(ACTIVE_PROVIDER_RUN_STORAGE_KEY);
	if (!raw) return null;

	try {
		const parsed = JSON.parse(raw) as Partial<ActiveProviderRun>;
		if (
			typeof parsed.workspaceId !== "string" ||
			typeof parsed.jobId !== "string" ||
			parsed.workspaceId.length === 0 ||
			parsed.jobId.length === 0
		) {
			return null;
		}
		return {
			workspaceId: parsed.workspaceId,
			jobId: parsed.jobId,
		};
	} catch {
		return null;
	}
}

export function persistActiveProviderRun(args: ActiveProviderRun): void {
	if (typeof window === "undefined") return;
	window.localStorage.setItem(
		ACTIVE_PROVIDER_RUN_STORAGE_KEY,
		JSON.stringify(args),
	);
	window.dispatchEvent(new Event(ACTIVE_PROVIDER_RUN_EVENT));
}

export function clearActiveProviderRun(): void {
	if (typeof window === "undefined") return;
	window.localStorage.removeItem(ACTIVE_PROVIDER_RUN_STORAGE_KEY);
	window.dispatchEvent(new Event(ACTIVE_PROVIDER_RUN_EVENT));
}

/**
 * Handles all non-success agent run result states.
 * Call this after every `api.agent.run.mutateAsync` call.
 *
 * Returns `true` if the run was queued successfully (caller should proceed).
 * Returns `false` for all error/non-success states (caller should stop).
 */
export function handleAgentRunResult(
	result: {
		status: string;
		jobId?: string | null;
	},
	options: {
		/** Called when the result is not a successful queue. */
		onDone: () => void;
	},
): result is { status: "queued"; jobId: string } {
	const { onDone } = options;

	if (result.status !== "queued" || !result.jobId) {
		clearActiveProviderRun();
		onDone();
		return false;
	}

	return true;
}

function ProviderRunToastCard({
	provider,
	phase,
	promptNumber,
	totalPrompts,
	onStop,
	isStopping,
}: {
	provider: Provider;
	phase: DisplayPhase;
	promptNumber?: number;
	totalPrompts?: number;
	onStop?: () => void | Promise<void>;
	isStopping?: boolean;
}) {
	return (
		<ProviderRunStatusCard
			provider={provider}
			phase={phase}
			onStop={phase === "running" ? onStop : undefined}
			isStopping={isStopping}
			promptNumber={promptNumber}
			totalPrompts={totalPrompts}
		/>
	);
}

function showProviderToast(args: {
	provider: Provider;
	phase: DisplayPhase;
	promptNumber?: number;
	totalPrompts?: number;
	onStop?: () => void | Promise<void>;
	isStopping?: boolean;
}) {
	toast.custom(
		() => (
			<ProviderRunToastCard
				provider={args.provider}
				phase={args.phase}
				promptNumber={args.promptNumber}
				totalPrompts={args.totalPrompts}
				onStop={args.onStop}
				isStopping={args.isStopping}
			/>
		),
		{
			id: PROVIDER_RUN_TOAST_ID,
			duration:
				args.phase === "pending" || args.phase === "running"
					? Number.POSITIVE_INFINITY
					: args.phase === "stopped"
						? STOPPED_HANDOFF_DELAY_MS
						: COMPLETION_TOAST_DURATION_MS,
		},
	);
}

function useProviderRunToast(args: {
	active: boolean;
	workspaceId: string;
	jobId: string | null;
	response: unknown;
}) {
	const { active, workspaceId, jobId, response } = args;
	const stopProviderMutation = api.agent.stopProvider.useMutation();
	const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const latestParsedRef = useRef<{
		updateId: number;
		providers: Record<string, ProviderState>;
		results: Record<string, number>;
		totalPrompts?: number;
	}>({
		updateId: 0,
		providers: {},
		results: {},
		totalPrompts: undefined,
	});
	const previousProviderStatesRef = useRef<Record<string, ProviderState>>({});
	const [stoppingProvider, setStoppingProvider] = useState<Provider | null>(
		null,
	);
	const displayRef = useRef<{
		provider: Provider;
		phase: DisplayPhase;
		promptNumber?: number;
	} | null>(null);

	const parsed = useMemo(() => {
		const data = response as ProviderProgressResponse | null | undefined;
		return {
			updateId: data?.updateId ?? 0,
			providers: (data?.providers ?? {}) as Record<string, ProviderState>,
			results: (data?.results ?? {}) as Record<string, number>,
			totalPrompts: data?.stats?.totalPrompts,
		};
	}, [response]);

	useEffect(() => {
		latestParsedRef.current = parsed;
	}, [parsed]);

	const buildStopHandler = useCallback(
		(provider: Provider) => {
			return async () => {
				if (!jobId || stoppingProvider === provider) return;
				setStoppingProvider(provider);
				try {
					await stopProviderMutation.mutateAsync({
						workspaceId,
						jobId,
						provider,
					});
				} finally {
					setStoppingProvider((current) =>
						current === provider ? null : current,
					);
				}
			};
		},
		[jobId, stopProviderMutation, stoppingProvider, workspaceId],
	);

	useEffect(() => {
		return () => {
			if (completionTimerRef.current) {
				clearTimeout(completionTimerRef.current);
				completionTimerRef.current = null;
			}
			toast.dismiss(PROVIDER_RUN_TOAST_ID);
		};
	}, []);

	useEffect(() => {
		if (!active) {
			if (completionTimerRef.current) {
				clearTimeout(completionTimerRef.current);
				completionTimerRef.current = null;
			}
			displayRef.current = null;
			toast.dismiss(PROVIDER_RUN_TOAST_ID);
			return;
		}

		if (!response) {
			displayRef.current = null;
			return;
		}

		const providerStates = parsed.providers;
		const previousStates = previousProviderStatesRef.current;
		const pendingProviders = PROVIDER_LIST.filter(
			(provider) => providerStates[provider] === "pending",
		);
		const runningProviders = PROVIDER_LIST.filter(
			(provider) => providerStates[provider] === "running",
		);
		const currentDisplay = displayRef.current;
		const transitionedProvider = PROVIDER_LIST.find((provider) => {
			const previousState = previousStates[provider];
			const nextState = providerStates[provider];

			return (
				previousState === "running" &&
				(nextState === "completed" ||
					nextState === "failed" ||
					nextState === "stopped")
			);
		});

		previousProviderStatesRef.current = providerStates;

		if (transitionedProvider) {
			const nextPhase =
				providerStates[transitionedProvider] === "completed"
					? "completed"
					: providerStates[transitionedProvider] === "stopped"
						? "stopped"
						: "failed";

			displayRef.current = { provider: transitionedProvider, phase: nextPhase };
			if (jobId) {
				showProviderToast({
					provider: transitionedProvider,
					phase: nextPhase,
					onStop: buildStopHandler(transitionedProvider),
					isStopping: stoppingProvider === transitionedProvider,
				});
			}

			if (completionTimerRef.current) {
				clearTimeout(completionTimerRef.current);
			}
			const handoffDelay =
				nextPhase === "stopped"
					? STOPPED_HANDOFF_DELAY_MS
					: COMPLETION_TOAST_DURATION_MS;
			completionTimerRef.current = setTimeout(() => {
				completionTimerRef.current = null;
				const latest = latestParsedRef.current;
				const nextRunningProvider = PROVIDER_LIST.find(
					(provider) => latest.providers[provider] === "running",
				);
				if (nextRunningProvider) {
					const nextPromptNumber =
						(latest.results[nextRunningProvider] ?? 0) > 0
							? latest.results[nextRunningProvider]
							: undefined;
					displayRef.current = {
						provider: nextRunningProvider,
						phase: "running",
						promptNumber: nextPromptNumber,
					};
					if (jobId) {
						showProviderToast({
							provider: nextRunningProvider,
							phase: "running",
							promptNumber: nextPromptNumber,
							totalPrompts: latest.totalPrompts,
							onStop: buildStopHandler(nextRunningProvider),
							isStopping: stoppingProvider === nextRunningProvider,
						});
					}
					return;
				}

				displayRef.current = null;
				toast.dismiss(PROVIDER_RUN_TOAST_ID);
			}, handoffDelay);
			return;
		}

		if (
			currentDisplay?.phase === "completed" ||
			currentDisplay?.phase === "failed" ||
			currentDisplay?.phase === "stopped"
		) {
			return;
		}

		const nextRunningProvider = runningProviders[0];
		const nextPromptNumber =
			nextRunningProvider && (parsed.results[nextRunningProvider] ?? 0) > 0
				? parsed.results[nextRunningProvider]
				: undefined;

		if (!nextRunningProvider) {
			const nextPendingProvider = pendingProviders[0];
			if (nextPendingProvider) {
				if (
					currentDisplay?.provider === nextPendingProvider &&
					currentDisplay.phase === "pending"
				) {
					return;
				}

				if (completionTimerRef.current) {
					clearTimeout(completionTimerRef.current);
					completionTimerRef.current = null;
				}

				displayRef.current = {
					provider: nextPendingProvider,
					phase: "pending",
				};
				if (jobId) {
					showProviderToast({
						provider: nextPendingProvider,
						phase: "pending",
						onStop: buildStopHandler(nextPendingProvider),
						isStopping: stoppingProvider === nextPendingProvider,
					});
				}
				return;
			}

			if (
				parsed.updateId > 0 &&
				parsed.providers &&
				Object.keys(parsed.providers).length > 0
			) {
				displayRef.current = null;
				toast.dismiss(PROVIDER_RUN_TOAST_ID);
			}
			return;
		}

		if (
			currentDisplay?.provider === nextRunningProvider &&
			currentDisplay.phase === "running" &&
			currentDisplay.promptNumber === nextPromptNumber
		) {
			return;
		}

		if (completionTimerRef.current) {
			clearTimeout(completionTimerRef.current);
			completionTimerRef.current = null;
		}

		displayRef.current = {
			provider: nextRunningProvider,
			phase: "running",
			promptNumber: nextPromptNumber,
		};
		if (jobId) {
			showProviderToast({
				provider: nextRunningProvider,
				phase: "running",
				promptNumber: nextPromptNumber,
				totalPrompts: parsed.totalPrompts,
				onStop: buildStopHandler(nextRunningProvider),
				isStopping: stoppingProvider === nextRunningProvider,
			});
		}
	}, [active, buildStopHandler, jobId, parsed, response, stoppingProvider]);
}

export function ProviderRunToastManager() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSafeSearchParams();
	const urlWorkspaceId = searchParams.get("workspace") ?? "";
	const urlJobId = searchParams.get("jobId") ?? "";
	const [persistedRun, setPersistedRun] = useState<ActiveProviderRun | null>(
		null,
	);
	const [dismissedJobId, setDismissedJobId] = useState<string | null>(null);

	useEffect(() => {
		const syncPersistedRun = () => {
			setPersistedRun(readActiveProviderRun());
		};

		syncPersistedRun();
		window.addEventListener(ACTIVE_PROVIDER_RUN_EVENT, syncPersistedRun);
		window.addEventListener("storage", syncPersistedRun);

		return () => {
			window.removeEventListener(ACTIVE_PROVIDER_RUN_EVENT, syncPersistedRun);
			window.removeEventListener("storage", syncPersistedRun);
		};
	}, []);

	useEffect(() => {
		if (!urlWorkspaceId || !urlJobId) return;
		if (dismissedJobId === urlJobId) return;
		const nextRun = { workspaceId: urlWorkspaceId, jobId: urlJobId };
		persistActiveProviderRun(nextRun);
		setPersistedRun(nextRun);
	}, [dismissedJobId, urlJobId, urlWorkspaceId]);

	const activeRun =
		urlWorkspaceId && urlJobId && dismissedJobId !== urlJobId
			? { workspaceId: urlWorkspaceId, jobId: urlJobId }
			: persistedRun;

	const jobStatusQuery = api.agent.status.useQuery(
		{
			workspaceId: activeRun?.workspaceId ?? "",
			jobId: activeRun?.jobId ?? "",
		},
		{
			enabled: !!activeRun,
			refetchInterval: 2000,
			refetchIntervalInBackground: true,
			refetchOnMount: "always",
			staleTime: 0,
		},
	);

	useProviderRunToast({
		active: !!activeRun,
		workspaceId: activeRun?.workspaceId ?? "",
		jobId: activeRun?.jobId ?? null,
		response: jobStatusQuery.data?.response,
	});

	useEffect(() => {
		if (jobStatusQuery.data?.status !== "completed") return;
		clearActiveProviderRun();
		setPersistedRun(null);
		if (activeRun?.jobId) {
			setDismissedJobId(activeRun.jobId);
		}

		if (urlJobId && pathname) {
			const params = new URLSearchParams(searchParams.toString());
			params.delete("jobId");
			const query = params.toString();
			router.replace(query ? `${pathname}?${query}` : pathname, {
				scroll: false,
			});
		}
	}, [
		activeRun?.jobId,
		jobStatusQuery.data?.status,
		pathname,
		router,
		searchParams,
		urlJobId,
	]);

	return null;
}
