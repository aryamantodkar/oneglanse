import { Card } from "@oneglanse/ui";
import { getModelFavicon } from "@oneglanse/utils";
import { PREVIEW_SOURCE_GROUPS } from "@/lib/preview-data";

export function SourcesMiniPreview(): React.JSX.Element {
  return (
    <Card className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Sources Page Preview</h3>
          <p className="mt-1 text-xs text-muted-foreground">Domain-level citation breakdown</p>
        </div>
        <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground dark:border-gray-700 dark:bg-gray-800">
          Compact View
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="grid grid-cols-[1.2fr_0.6fr_0.5fr_0.7fr] border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground dark:border-gray-800 dark:bg-gray-900/80">
          <span>Domain</span>
          <span className="text-right">Citations</span>
          <span className="text-right">Share</span>
          <span className="text-right">Models</span>
        </div>
        <div>
          {PREVIEW_SOURCE_GROUPS.map((group) => (
            <div key={group.domain} className="grid grid-cols-[1.2fr_0.6fr_0.5fr_0.7fr] items-center border-b border-gray-100 px-3 py-2.5 text-xs last:border-0 dark:border-gray-800">
              <span className="truncate font-medium text-gray-900 dark:text-gray-100">{group.domain}</span>
              <span className="text-right text-gray-700 dark:text-gray-300">{group.citations}</span>
              <span className="text-right text-gray-700 dark:text-gray-300">{group.share}%</span>
              <span className="flex justify-end gap-1">
                {group.providers.slice(0, 3).map((provider) => (
                  <img
                    key={`${group.domain}-${provider}`}
                    src={getModelFavicon(provider)}
                    alt={provider}
                    className="h-4 w-4 rounded-sm"
                  />
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
