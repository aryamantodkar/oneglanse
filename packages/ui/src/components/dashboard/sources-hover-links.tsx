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
  const visibleLinks = showAllLinks ? linksToShow : linksToShow.slice(0, maxVisible);
  const remainingCount = linksToShow.length - maxVisible;

  if (linksToShow.length === 0) return null;

  return (
    <div className="group mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
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
            className="relative inline-flex h-[36px] items-start gap-2 overflow-hidden rounded-md border border-gray-200/60 bg-gray-50/50 px-2.5 py-2 text-[11px] text-gray-600 transition-all duration-200 ease-out group-hover:h-[52px] dark:border-gray-800/70 dark:bg-neutral-950/70 dark:text-gray-400"
          >
            {faviconUrls[0] ? (
              <img
                src={faviconUrls[0]}
                alt=""
                className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded-sm opacity-75 transition-opacity group-hover:opacity-100"
              />
            ) : null}

            <div className="flex flex-col gap-0.5 overflow-hidden">
              <span className="line-clamp-2 leading-snug">{item.title}</span>
              {domain ? (
                <span className="translate-y-1 truncate text-[10px] text-gray-400 opacity-0 transition-all delay-75 duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100">
                  {domain}
                </span>
              ) : null}
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
          className="inline-flex items-center rounded-md border border-dashed border-gray-300/70 px-2.5 py-1.5 text-[11px] text-gray-500 transition hover:border-gray-400 hover:text-gray-700 dark:border-gray-700/70 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200"
          type="button"
        >
          +{remainingCount} more
        </button>
      ) : null}
    </div>
  );
}
