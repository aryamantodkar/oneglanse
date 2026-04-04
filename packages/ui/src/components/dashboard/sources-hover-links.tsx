"use client";

import { getDomain, getFaviconUrls, getUniqueLinks } from "@oneglanse/utils";
import { useMemo, useState } from "react";

export type HoverSourceLink = {
	title?: string;
	url?: string;
};

export function SourcesHoverLinks({
	items,
	maxVisible = 5,
}: {
	items: HoverSourceLink[];
	maxVisible?: number;
}): React.JSX.Element | null {
	const [showAllLinks, setShowAllLinks] = useState(false);

	const linksToShow = useMemo(() => getUniqueLinks(items), [items]);
	const visibleLinks = showAllLinks
		? linksToShow
		: linksToShow.slice(0, maxVisible);
	const remainingCount = linksToShow.length - maxVisible;

	if (linksToShow.length === 0) return null;

	return (
		<div className="mt-4 flex flex-wrap gap-2.5">
			{visibleLinks.map((item, index) => {
				const faviconUrls = getFaviconUrls(item.url, "");
				const domain = getDomain(item.url);

				return (
					<a
						key={`${item.url}-${index}`}
						href={item.url}
						target="_blank"
						rel="noopener noreferrer"
						onClick={(e) => e.stopPropagation()}
						title={item.title}
						className="inline-flex min-h-11 w-fit max-w-[16rem] items-start gap-2.5 rounded-[20px] border border-transparent bg-stone-50 px-3.5 py-2.5 text-[11px] text-gray-600 shadow-[0_16px_40px_-26px_rgba(15,23,42,0.22)] transition-[background-color,box-shadow,color] duration-200 ease-out hover:bg-white hover:text-gray-900 hover:shadow-[0_16px_40px_-22px_rgba(15,23,42,0.28)] dark:border-transparent dark:bg-neutral-900/80 dark:text-gray-400 dark:shadow-[0_16px_40px_-26px_rgba(0,0,0,0.48)] dark:hover:bg-neutral-950 dark:hover:text-gray-100"
					>
						{faviconUrls[0] ? (
							<img
								src={faviconUrls[0]}
								alt=""
								className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-sm opacity-80"
							/>
						) : null}

						<div className="min-w-0 flex-1 overflow-hidden">
							{domain ? (
								<span className="mb-1 block truncate text-[10px] font-medium uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">
									{domain}
								</span>
							) : null}
							<span className="line-clamp-2 break-words text-[11px] leading-snug text-gray-700 dark:text-gray-300">
								{item.title}
							</span>
						</div>
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
