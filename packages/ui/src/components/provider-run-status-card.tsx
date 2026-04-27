"use client";

import { cn, getModelFavicon, getProviderDisplayName } from "@oneglanse/utils";
import { CheckCircle2, StopCircle, XCircle } from "lucide-react";

export type ProviderRunDisplayPhase =
	| "pending"
	| "running"
	| "completed"
	| "failed"
	| "stopped";

function Spinner({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"rounded-full border-2 border-gray-200 border-t-gray-500 dark:border-white/10 dark:border-t-white/50",
				className,
			)}
		/>
	);
}

export function ProviderRunStatusCard(props: {
	provider: string;
	phase: ProviderRunDisplayPhase;
	onStop?: () => void | Promise<void>;
	isStopping?: boolean;
	promptNumber?: number;
	totalPrompts?: number;
}) {
	const {
		provider,
		phase,
		onStop,
		isStopping = false,
		promptNumber,
		totalPrompts,
	} = props;
	const title = getProviderDisplayName(provider);
	const isActive = phase === "running" || phase === "pending";
	const canStop = phase === "running" && Boolean(onStop) && !isStopping;

	const showProgress =
		phase === "running" &&
		!isStopping &&
		promptNumber !== undefined &&
		totalPrompts !== undefined &&
		totalPrompts > 0;

	const progressPct = showProgress
		? Math.round((promptNumber! / totalPrompts!) * 100)
		: 0;

	function getSubtitle() {
		if (phase === "pending") return "Queued: waiting to start";
		if (phase === "running") {
			if (isStopping) return "Canceling prompts…";
			if (showProgress) {
				return `Prompt ${promptNumber} of ${totalPrompts}`;
			}
			return "Running prompts, please wait…";
		}
		if (phase === "completed") return "Responses saved.";
		if (phase === "stopped") return "Stopped at your request.";
		return "This provider needs another attempt.";
	}

	const logoGlow =
		phase === "completed"
			? "bg-emerald-400/25 dark:bg-emerald-500/20"
			: phase === "failed"
				? "bg-red-400/25 dark:bg-red-500/20"
				: phase === "stopped"
					? "bg-slate-400/20 dark:bg-slate-500/15"
					: "bg-gray-300/30 dark:bg-white/10";

	return (
		<div className="pointer-events-auto w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-100/80 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.10),0_1px_4px_-1px_rgba(0,0,0,0.05)] animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-95 duration-200 dark:border-white/[0.06] dark:bg-neutral-900 dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.45)]">
			<div className="px-4 py-3.5">
				<div className="flex items-center gap-3">
					{/* Provider logo */}
					<div className="relative shrink-0">
						<div
							className={cn(
								"absolute -inset-1.5 rounded-xl blur-lg transition-all duration-500",
								logoGlow,
							)}
						/>
						<img
							src={getModelFavicon(provider)}
							alt={title}
							className="relative h-7 w-7 rounded-lg object-contain"
						/>
					</div>

					{/* Text — re-animates on provider / phase change */}
					<div
						key={`${provider}-${phase}-${promptNumber ?? ""}`}
						className="min-w-0 flex-1 animate-in fade-in-0 duration-200"
					>
						<p className="truncate text-[14px] font-semibold leading-tight text-gray-900 dark:text-gray-100">
							{title}
						</p>
						<p
							className={cn(
								"mt-0.5 text-[12px] leading-tight transition-colors duration-300",
								phase === "pending"
									? "text-gray-400 dark:text-gray-500"
									: phase === "running"
										? "text-gray-500 dark:text-gray-400"
										: phase === "completed"
											? "text-emerald-600 dark:text-emerald-400"
											: phase === "stopped"
												? "text-slate-500 dark:text-slate-400"
												: "text-red-500 dark:text-red-400",
							)}
						>
							{getSubtitle()}
						</p>
					</div>

					{/* Right side */}
					<div className="flex shrink-0 items-center gap-2">
						{isActive && (
							<Spinner
								className={cn(
									"h-5 w-5",
									phase === "pending"
										? "animate-[spin_2.4s_linear_infinite]"
										: "animate-spin",
								)}
							/>
						)}
						{canStop && (
							<button
								type="button"
								onClick={() => void onStop?.()}
								className="flex h-8 w-8 items-center justify-center rounded-lg text-red-400 transition-all duration-150 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400"
								aria-label="Stop run"
							>
								<StopCircle className="h-5 w-5" />
							</button>
						)}
						{phase === "completed" && (
							<CheckCircle2 className="h-5 w-5 text-emerald-500" />
						)}
						{phase === "failed" && (
							<XCircle className="h-5 w-5 text-red-500" />
						)}
					</div>
				</div>

				{/* Progress bar */}
				{showProgress && (
					<div className="mt-3">
						<div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
							<div
								className="h-1.5 rounded-full bg-gray-900 transition-all duration-500 ease-out dark:bg-white"
								style={{ width: `${progressPct}%` }}
							/>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
