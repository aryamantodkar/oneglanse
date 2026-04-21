"use client";

import {
	formatDate,
	formatMarkdown,
	getModelFavicon,
	getProviderDisplayName,
} from "@oneglanse/utils";
import { cn } from "@oneglanse/utils";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { PositionMetricCell, SentimentMetricCell } from "../cell.js";
import { SourcesHoverLinks } from "./sources-hover-links.js";

export type PromptResponsePreviewSource = {
	title: string;
	url: string;
};

export type PromptResponsePreviewRow = {
	id: string;
	modelProvider: string;
	modelName?: string;
	promptRunAt: string;
	response: string;
	isAnalysed: boolean;
	metrics?: {
		geoScore: number;
		sentiment: number;
		visibility: number;
		position: number | null;
	};
	sources: PromptResponsePreviewSource[];
};

function getProviderName(row: PromptResponsePreviewRow): string {
	if (row.modelName) return row.modelName;
	return getProviderDisplayName(row.modelProvider);
}

export function PromptResponsesPreview({
	title,
	description,
	rows,
}: {
	title: string;
	description: string;
	rows: PromptResponsePreviewRow[];
}): React.JSX.Element {
	const [expandedResponses, setExpandedResponses] = useState<Set<number>>(
		new Set(),
	);

	const toggleResponse = (index: number) => {
		setExpandedResponses((prev) => {
			const next = new Set(prev);
			next.has(index) ? next.delete(index) : next.add(index);
			return next;
		});
	};

	return (
		<section aria-label="Prompt responses preview" className="space-y-5">
			{(title || description) && (
				<div>
					{title && (
						<h1 className="mt-2 text-base font-semibold leading-none tracking-tight text-gray-900 sm:text-lg dark:text-gray-100">
							{title}
						</h1>
					)}
					{description && (
						<p className="mt-2 max-w-2xl text-xs text-muted-foreground">
							{description}
						</p>
					)}
				</div>
			)}

			<div className="space-y-4.5">
				{rows.map((row, index) => {
					const isExpanded = expandedResponses.has(index);
					return (
						<div
							key={row.id}
							onClick={() => toggleResponse(index)}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									toggleResponse(index);
								}
							}}
							className={cn(
								"group cursor-pointer rounded-[var(--app-radius)] border border-gray-100/80 bg-white px-5 py-5 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.16)] transition-[box-shadow,border-color] duration-200 ease-out hover:shadow-[0_20px_60px_-28px_rgba(15,23,42,0.18)] dark:border-gray-800 dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.5)] sm:px-6 sm:py-6",
								isExpanded &&
									"border-gray-200 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.22)] dark:border-gray-700",
							)}
						>
							<div className="mb-4 flex items-start justify-between gap-4">
								<div className="flex items-center gap-3">
									<img
										src={getModelFavicon(row.modelProvider)}
										alt={row.modelProvider}
										className="h-9 w-9 rounded-[var(--app-radius)]"
									/>
									<div className="flex flex-col">
										<span className="text-sm font-medium text-gray-950 dark:text-gray-50">
											{getProviderName(row)}
										</span>
										<span className="text-[11px] text-gray-500 dark:text-gray-400">
											{formatDate(row.promptRunAt)}
										</span>
									</div>
								</div>

								<ChevronDown
									className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
										isExpanded ? "rotate-180" : "rotate-0"
									} group-hover:text-gray-600 dark:group-hover:text-gray-300`}
								/>
							</div>

							{row.isAnalysed && row.metrics ? (
								<div className="mb-4 rounded-[var(--app-radius)] border border-gray-100/80 bg-white px-4 py-3 dark:border-gray-800 dark:bg-neutral-950">
									<div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
										<div className="flex items-center gap-1.5">
											<span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
												GEO Score
											</span>
											<span
												className="text-xs font-semibold"
												style={{
													color:
														row.metrics.geoScore >= 60
															? "#22c55e"
															: row.metrics.geoScore >= 30
																? "#f59e0b"
																: "#ef4444",
												}}
											>
												{row.metrics.geoScore}
											</span>
										</div>
										<div className="flex items-center gap-1.5">
											<span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
												Sentiment
											</span>
											<div className="text-xs">
												<SentimentMetricCell
													sentiment={row.metrics.sentiment}
												/>
											</div>
										</div>
										<div className="flex items-center gap-1.5">
											<span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
												Visibility
											</span>
											<span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
												{row.metrics.visibility}%
											</span>
										</div>
										<div className="flex items-center gap-1.5">
											<span className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
												Position
											</span>
											<div className="text-xs">
												{row.metrics.position !== null ? (
													<PositionMetricCell position={row.metrics.position} />
												) : (
													<span className="italic text-gray-400">N/A</span>
												)}
											</div>
										</div>
									</div>
								</div>
							) : null}

							<div
								className={`prose max-w-none text-gray-700 dark:prose-invert dark:text-gray-300 ${
									isExpanded
										? "max-h-[400px] overflow-y-auto"
										: "line-clamp-3 overflow-hidden"
								}`}
								// biome-ignore lint/security/noDangerouslySetInnerHtml: markdown is sanitized by shared formatter before rendering
								dangerouslySetInnerHTML={{
									__html: formatMarkdown(row.response),
								}}
							/>

							<button
								onClick={(e) => {
									e.stopPropagation();
									toggleResponse(index);
								}}
								className="mt-4 inline-flex items-center rounded-[var(--app-radius)] px-0 py-0 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
								type="button"
							>
								{isExpanded ? "Show less" : "View full response"}
							</button>

							<SourcesHoverLinks items={row.sources} />
						</div>
					);
				})}
			</div>
		</section>
	);
}
