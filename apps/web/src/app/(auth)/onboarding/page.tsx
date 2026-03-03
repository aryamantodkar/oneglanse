"use client";

import { api } from "@/trpc/react";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Textarea,
	toast,
} from "@oneglanse/ui";
import { PROVIDER_LIST } from "@oneglanse/types";
import { getProviderDisplayName } from "@oneglanse/utils";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const SUGGESTED_PROMPTS = [
	"What are the best alternatives to {brand} for growing teams?",
	"Which tools are most recommended for sales pipeline management?",
	"What are the top platforms for customer support automation in 2026?",
	"Compare {brand} with top competitors for pricing and value.",
	"Which software is best for CRM + marketing automation together?",
	"What are the most trusted solutions for enterprise workflow automation?",
	"What tool is easiest to set up for small businesses in this category?",
	"Which brands are most frequently cited for reliability and support?",
];

type ProviderState = "pending" | "running" | "completed" | "failed";

export default function FirstWorkspaceOnboardingPage(){
	const router = useRouter();
	const searchParams = useSearchParams();
	const workspaceId = searchParams.get("workspace") ?? "";

	const [promptInput, setPromptInput] = useState("");
	const [jobId, setJobId] = useState<string | null>(null);
	const [started, setStarted] = useState(false);
	const [redirecting, setRedirecting] = useState(false);

	const workspaceQuery = api.workspace.getById.useQuery(
		{ workspaceId },
		{ enabled: !!workspaceId },
	);
	const storePrompts = api.prompt.store.useMutation();
	const runAgent = api.agent.run.useMutation();
	const analysisQuery = api.analysis.fetchAnalysis.useQuery(
		{ workspaceId },
		{ enabled: started && !!workspaceId, refetchInterval: 3000 },
	);
	const jobStatusQuery = api.agent.status.useQuery(
		{ workspaceId, jobId: jobId ?? "" },
		{ enabled: !!jobId && !!workspaceId, refetchInterval: 2000 },
	);

	const brandName = workspaceQuery.data?.name ?? "your brand";
	const brandDomain = workspaceQuery.data?.domain ?? "";

	const suggestedPrompts = useMemo(
		() =>
			SUGGESTED_PROMPTS.map((prompt) =>
				prompt.replaceAll("{brand}", brandName || "your brand"),
			),
		[brandName],
	);

	const providerStates = useMemo(() => {
		const response = jobStatusQuery.data?.response as
			| {
					providers?: Record<string, ProviderState>;
					stats?: { expectedResponses?: number; actualResponses?: number };
			  }
			| undefined;
		return response?.providers ?? {};
	}, [jobStatusQuery.data?.response]);

	const progressPercent = useMemo(() => {
		const response = jobStatusQuery.data?.response as
			| {
					providers?: Record<string, ProviderState>;
					stats?: { expectedResponses?: number; actualResponses?: number };
			  }
			| undefined;

		const expected = response?.stats?.expectedResponses ?? 0;
		const actual = response?.stats?.actualResponses ?? 0;
		if (expected > 0) {
			return Math.max(5, Math.min(100, Math.round((actual / expected) * 100)));
		}

		const states = Object.values(response?.providers ?? {});
		if (states.length === 0) return 5;
		const total = states.reduce((sum, state) => {
			if (state === "completed" || state === "failed") return sum + 1;
			if (state === "running") return sum + 0.5;
			return sum;
		}, 0);
		return Math.max(
			5,
			Math.min(100, Math.round((total / states.length) * 100)),
		);
	}, [jobStatusQuery.data?.response]);

	const analysisCount = useMemo(() => {
		return analysisQuery.data?.length ?? 0;
	  }, [analysisQuery.data]);

	useEffect(() => {
		if (!started || redirecting || analysisCount === 0) return;

		setRedirecting(true);
		toast.success(
			"First insights are ready. We’re still processing remaining prompts in the background.",
		);
		const timeout = setTimeout(() => {
			router.replace(`/dashboard?workspace=${workspaceId}`);
		}, 1200);
		return () => clearTimeout(timeout);
	}, [analysisCount, redirecting, router, started, workspaceId]);

	const appendPrompt = (prompt: string) => {
		const current = promptInput.trim();
		if (!current) {
			setPromptInput(prompt);
			return;
		}
		if (current.split("\n").some((line) => line.trim() === prompt.trim()))
			return;
		setPromptInput(`${current}\n${prompt}`);
	};

	const handleStart = async () => {
		if (!workspaceId) {
			toast.error("Workspace is missing.");
			return;
		}

		const prompts = promptInput
			.split("\n")
			.map((line) => line.trim())
			.filter(Boolean);

		if (prompts.length === 0) {
			toast.error("Add at least one prompt to start onboarding.");
			return;
		}

		try {
			await storePrompts.mutateAsync({ workspaceId, prompts });
			const run = await runAgent.mutateAsync({ workspaceId });
			const nextJobId = run?.jobId;
			if (!nextJobId) {
				toast.error("Prompts were saved, but run could not be started.");
				return;
			}
			setJobId(nextJobId);
			setStarted(true);
			toast.success(
				"Prompts are running now. We’ll redirect you to the dashboard as soon as first data is available.",
			);
		} catch (err) {
			console.error(err);
			toast.error("Failed to start onboarding run.");
		}
	};

	if (!workspaceId) {
		return (
			<div className="flex min-h-screen items-center justify-center">
				<p className="text-sm text-muted-foreground">No workspace selected.</p>
			</div>
		);
	}

	return (
		<div className="ui-page-enter min-h-screen bg-gradient-to-b from-gray-50 to-white px-4 py-10 dark:from-gray-950 dark:to-gray-950">
			<div className="ui-stagger mx-auto w-full max-w-5xl">
				<Card className="overflow-hidden border-gray-200/80 shadow-xl dark:border-gray-800">
					<CardHeader className="border-b border-gray-100 bg-white/90 pb-5 dark:border-gray-800 dark:bg-gray-900/50">
						<div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800">
							<Sparkles className="h-5 w-5 text-gray-700 dark:text-gray-200" />
						</div>
						<CardTitle className="text-2xl">
							Set up your first GEO visibility run
						</CardTitle>
						<CardDescription className="max-w-3xl text-sm">
							Add prompts that matter for buyers in your category. We will run
							and analyze them once now, then move you to your dashboard as soon
							as first insights are ready.
						</CardDescription>
						<p className="text-xs text-muted-foreground">
							Brand:{" "}
							<span className="font-medium text-gray-900 dark:text-gray-100">
								{brandName}
							</span>
							{brandDomain ? ` (${brandDomain})` : ""}
						</p>
					</CardHeader>

					<CardContent className="space-y-6 bg-white p-4 sm:p-6 dark:bg-gray-950">
						{!started ? (
							<>
								<div className="space-y-2">
									<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
										Prompt inputs
									</p>
									<Textarea
										rows={10}
										value={promptInput}
										onChange={(e) => setPromptInput(e.target.value)}
										placeholder="Enter one prompt per line..."
										className="resize-none"
									/>
									<p className="text-xs text-muted-foreground">
										Add one prompt per line. We recommend starting with 6-10
										prompts.
									</p>
								</div>

								<div className="space-y-3">
									<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
										Suggested prompts for AI visibility
									</p>
									<div className="flex flex-wrap gap-2">
										{suggestedPrompts.map((prompt) => (
											<button
												key={prompt}
												type="button"
												onClick={() => appendPrompt(prompt)}
												className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-left text-xs text-gray-700 transition hover:border-gray-300 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-800"
											>
												+ {prompt}
											</button>
										))}
									</div>
								</div>

								<div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
									<Button
										variant="outline"
										onClick={() =>
											router.replace(`/dashboard?workspace=${workspaceId}`)
										}
										className="w-full sm:w-auto"
									>
										Skip for now
									</Button>
									<Button
										onClick={handleStart}
										disabled={storePrompts.isPending || runAgent.isPending}
										className="w-full sm:w-auto sm:min-w-[220px]"
									>
										{storePrompts.isPending || runAgent.isPending ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											"Save Prompts & Run Analysis"
										)}
									</Button>
								</div>
							</>
						) : (
							<div className="space-y-6">
								<div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-900/50">
									<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
										We are running your prompts in the background.
									</p>
									<p className="mt-1 text-sm text-muted-foreground">
										We will redirect you to the dashboard as soon as some data
										is available.
									</p>
								</div>

								<div className="space-y-2">
									<div className="flex items-center justify-between text-sm">
										<span className="font-medium text-gray-900 dark:text-gray-100">
											Processing progress
										</span>
										<span className="text-muted-foreground">
											{progressPercent}%
										</span>
									</div>
									<div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
										<div
											className="h-full rounded-full bg-gray-900 transition-[width] duration-500 ease-out dark:bg-gray-100"
											style={{ width: `${progressPercent}%` }}
										/>
									</div>
								</div>

								<div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
									{PROVIDER_LIST.map((provider) => {
										const state = providerStates[provider] ?? "pending";
										const isDone = state === "completed";
										const isFailed = state === "failed";
										return (
											<div
												key={provider}
												className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-800 dark:bg-gray-900"
											>
												<div className="flex items-center justify-between">
													<p className="text-sm font-medium text-gray-900 dark:text-gray-100">
														{getProviderDisplayName(provider)}
													</p>
													{isDone ? (
														<CheckCircle2 className="h-4 w-4 text-emerald-500" />
													) : state === "running" ? (
														<Loader2 className="h-4 w-4 animate-spin text-blue-500" />
													) : isFailed ? (
														<span className="text-xs text-red-500">Failed</span>
													) : (
														<span className="text-xs text-muted-foreground">
															Pending
														</span>
													)}
												</div>
											</div>
										);
									})}
								</div>

								<div className="flex items-center justify-end">
									<Button
										variant="outline"
										onClick={() =>
											router.replace(`/dashboard?workspace=${workspaceId}`)
										}
									>
										Go to dashboard
									</Button>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
