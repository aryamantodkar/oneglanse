"use client";

import { cn } from "@oneglanse/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { PromptResponsePreviewRow } from "./prompt-responses-preview.js";
import { PromptResponsesPreview } from "./prompt-responses-preview.js";

export type PromptGroup = {
	promptId: string;
	promptText: string;
	rows: PromptResponsePreviewRow[];
};

const INITIAL_VISIBLE = 4;

export function PromptResponsesList({
	groups,
}: {
	groups: PromptGroup[];
}): React.JSX.Element | null {
	const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(
		new Set(),
	);
	const [showAll, setShowAll] = useState(false);

	if (groups.length === 0) return null;

	const visibleGroups = showAll ? groups : groups.slice(0, INITIAL_VISIBLE);

	const togglePrompt = (promptId: string) => {
		setExpandedPrompts((prev) => {
			const next = new Set(prev);
			next.has(promptId) ? next.delete(promptId) : next.add(promptId);
			return next;
		});
	};

	return (
		<section aria-label="Prompt responses" className="space-y-4">
			<div className="py-2 sm:py-3">
				<h1 className="mt-2 text-base font-semibold leading-none tracking-tight text-gray-900 sm:text-lg dark:text-gray-100">
					Prompt Responses
				</h1>
				<p className="mt-2 text-xs text-muted-foreground">
					Expand a prompt to see the raw response from each provider.
				</p>
			</div>

			<div className="space-y-2">
				{visibleGroups.map((group) => {
					const isExpanded = expandedPrompts.has(group.promptId);
					return (
						<div
							key={group.promptId}
							className="overflow-hidden rounded-[var(--app-radius)] border border-gray-100/80 bg-white shadow-[0_20px_60px_-32px_rgba(15,23,42,0.16)] dark:border-gray-800 dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.5)]"
						>
							{/* Prompt header — always visible */}
							<button
								type="button"
								onClick={() => togglePrompt(group.promptId)}
								className={cn(
									"flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors duration-150 sm:px-6",
									isExpanded
										? "bg-gray-50/80 dark:bg-neutral-900/60"
										: "hover:bg-gray-50/60 dark:hover:bg-neutral-900/40",
								)}
							>
								<span className="line-clamp-1 min-w-0 flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">
									{group.promptText}
								</span>
								<div className="flex shrink-0 items-center gap-2">
									<span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400">
										{group.rows.length}{" "}
										{group.rows.length === 1 ? "response" : "responses"}
									</span>
									<ChevronDown
										className={cn(
											"h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 dark:text-gray-500",
											isExpanded && "rotate-180",
										)}
									/>
								</div>
							</button>

							{/* Expanded responses */}
							{isExpanded && (
								<div className="border-t border-gray-100 dark:border-gray-800">
									<div className="divide-y divide-gray-100/80 dark:divide-gray-800">
										{group.rows.map((row) => (
											<div key={row.id} className="px-5 py-4 sm:px-6">
												<PromptResponsesPreview
													title=""
													description=""
													rows={[row]}
												/>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* Show more / show less */}
			{groups.length > INITIAL_VISIBLE && (
				<button
					type="button"
					onClick={() => setShowAll((prev) => !prev)}
					className="inline-flex items-center gap-1.5 rounded-[var(--app-radius)] px-0 py-0 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
				>
					{showAll ? "Show fewer prompts" : `Show all ${groups.length} prompts`}
					<ChevronDown
						className={cn(
							"h-4 w-4 transition-transform duration-200",
							showAll && "rotate-180",
						)}
					/>
				</button>
			)}
		</section>
	);
}
