"use client";

import {
	cleanCitedText,
	getDomain,
	getFaviconUrls,
} from "@oneglanse/utils";
import { useMemo, useState } from "react";

export type HoverSourceLink = {
	title?: string;
	url?: string;
	cited_text?: string;
};

type NormalizedHoverSourceLink = {
	title: string;
	url: string;
	cited_text?: string;
};

export function SourcesHoverLinks({
	items,
	maxVisible = 5,
}: {
	items: HoverSourceLink[];
	maxVisible?: number;
}): React.JSX.Element | null {
	const [showAllLinks, setShowAllLinks] = useState(false);
	const [activeCardId, setActiveCardId] = useState<string | null>(null);

	const linksToShow = useMemo(
		() => {
			const normalized: NormalizedHoverSourceLink[] = [];

			for (const item of items) {
				const rawUrl = item.url?.trim();
				if (!rawUrl) continue;

				const url = rawUrl.replace(/#.*$/, "");
				if (!url) continue;

				normalized.push({
					title: item.title || url,
					url,
					cited_text: item.cited_text,
				});
			}

			return normalized;
		},
		[items],
	);
	const duplicateCounts = useMemo(() => {
		const counts = new Map<string, number>();

		for (const item of items) {
			const url = item.url?.trim();
			if (!url) continue;
			const domain = getDomain(url) ?? "";
			const title = (item.title || url).trim().toLowerCase();
			const key = `${domain}::${title}`;
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}

		return counts;
	}, [items]);
	const visibleLinks = showAllLinks
		? linksToShow
		: linksToShow.slice(0, maxVisible);
	const remainingCount = linksToShow.length - maxVisible;

	if (linksToShow.length === 0) return null;

	return (
		<div className="mt-4 flex flex-wrap items-start gap-2.5">
			{visibleLinks.map((item, index) => {
				const cardId = `${item.url}-${index}`;
				const faviconUrls = getFaviconUrls(item.url, "");
				const domain = getDomain(item.url);
				const citedText = cleanCitedText(item.cited_text?.trim() || "");
				const duplicateKey = `${domain ?? ""}::${(item.title || item.url || "").trim().toLowerCase()}`;
				const duplicateCount = duplicateCounts.get(duplicateKey) ?? 1;
				const showDuplicateBadge = duplicateCount > 1;
				const isActive = activeCardId === cardId;

				return (
					<a
						key={cardId}
						href={item.url}
						target="_blank"
						rel="noopener noreferrer"
						onClick={(e) => e.stopPropagation()}
						onMouseEnter={() => setActiveCardId(cardId)}
						onMouseLeave={() =>
							setActiveCardId((current) =>
								current === cardId ? null : current,
							)
						}
						onFocus={() => setActiveCardId(cardId)}
						onBlur={(e) => {
							if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
								setActiveCardId((current) =>
									current === cardId ? null : current,
								);
							}
						}}
						title={item.title}
						className={`inline-flex min-h-11 w-fit max-w-[18rem] flex-col gap-2 rounded-[22px] border px-3.5 py-3 text-[11px] shadow-[0_16px_40px_-26px_rgba(15,23,42,0.22)] transition-[background-color,box-shadow,color,transform,border-color,opacity,max-height] duration-200 ease-out ${
							isActive
								? "border-stone-200 bg-white text-gray-900 -translate-y-0.5 shadow-[0_18px_44px_-20px_rgba(15,23,42,0.28)] dark:border-white/15 dark:bg-neutral-950 dark:text-gray-100"
								: activeCardId
									? "border-transparent bg-stone-50/75 text-gray-500 opacity-45 saturate-50 dark:bg-neutral-900/55 dark:text-gray-500"
									: "border-transparent bg-stone-50 text-gray-600 hover:-translate-y-0.5 hover:bg-white hover:text-gray-900 hover:shadow-[0_18px_44px_-20px_rgba(15,23,42,0.28)] dark:bg-neutral-900/80 dark:text-gray-400 dark:hover:bg-neutral-950 dark:hover:text-gray-100"
						}`}
					>
						<div className="flex items-start gap-2.5">
							{faviconUrls[0] ? (
								<img
									src={faviconUrls[0]}
									alt=""
									className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-sm opacity-80"
								/>
							) : null}

							<div className="min-w-0 flex-1 overflow-hidden">
								<div className="mb-1 flex items-center gap-1.5">
									{domain ? (
										<span className="block min-w-0 truncate text-[10px] font-medium uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">
											{domain}
										</span>
									) : null}
									{showDuplicateBadge ? (
										<span className="inline-flex flex-shrink-0 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-medium tracking-[0.04em] text-gray-500 shadow-[0_4px_10px_-8px_rgba(15,23,42,0.5)] dark:bg-neutral-950/90 dark:text-gray-400">
											{duplicateCount} citations
										</span>
									) : null}
								</div>
								<span
									className={`line-clamp-2 break-words text-[11px] leading-snug ${
										isActive
											? "font-medium text-gray-900 dark:text-gray-100"
											: "text-gray-700 dark:text-gray-300"
									}`}
								>
									{item.title}
								</span>
							</div>
						</div>

						{citedText ? (
							<div
								className={`overflow-hidden rounded-[16px] border px-3 py-0 text-[10px] leading-relaxed transition-[max-height,opacity,padding,margin,border-color,background-color,color] duration-200 ease-out ${
									isActive
										? "mt-0.5 max-h-44 border-black/5 bg-white/70 py-3 text-gray-700 opacity-100 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-200"
										: activeCardId
											? "max-h-0 border-transparent bg-transparent py-0 opacity-0"
											: "max-h-0 border-transparent bg-transparent py-0 opacity-0"
								}`}
								aria-hidden={!isActive}
							>
								<span className="mb-1.5 block text-[9px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
									Cited text
								</span>
								<span className="line-clamp-5 break-words font-medium text-gray-900 dark:text-gray-100">
									{citedText}
								</span>
							</div>
						) : null}
					</a>
				);
			})}

			{!showAllLinks && remainingCount > 0 ? (
				<button
					onClick={(e) => {
						e.stopPropagation();
						setShowAllLinks(true);
					}}
					className="inline-flex min-h-11 items-center rounded-[20px] border border-transparent bg-stone-50 px-3.5 py-2 text-[11px] font-medium text-gray-500 shadow-[0_16px_40px_-26px_rgba(15,23,42,0.22)] transition-[background-color,box-shadow,color] hover:bg-white hover:text-gray-900 hover:shadow-[0_16px_40px_-22px_rgba(15,23,42,0.28)] dark:border-transparent dark:bg-neutral-900/80 dark:text-gray-400 dark:shadow-[0_16px_40px_-26px_rgba(0,0,0,0.48)] dark:hover:bg-neutral-950 dark:hover:text-gray-100"
					type="button"
				>
					+{remainingCount} more
				</button>
			) : null}
		</div>
	);
}
