"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFaviconUrls, getModelFavicon } from "@/lib/ui/favicon";
import { api } from "@/trpc/react";
import type { Competitor } from "@/server/db/types";
import { useCompetitors } from "./_lib/competitors.queries";

export default function Page() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const [competitorsData, setCompetitorsData] = useState<Competitor[]>([]);

  const { data: competitors, refetch, isLoading, error } = useCompetitors(workspaceId);

  useEffect(() => {
    if (competitors?.data?.length) {
        setCompetitorsData(competitors?.data)
      }
  }, [competitors]);

  return (
    <div className="px-6 py-6 space-y-10">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Competitors
      </h1>

      {isLoading || competitorsData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
            <div className="mb-4 flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse">
            <span className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600" />
            </div>

            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Analyzing competitors
            </h3>

            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            We’re identifying your direct competitors.  
            This usually takes a few minutes — please check back shortly.
            </p>
        </div>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {competitorsData.map((c) => {
                const faviconUrls = getFaviconUrls(c.domain ?? "", c.name);

                return (
                    <div
                    key={c.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4"
                    >
                    {/* Left */}
                    <div className="flex items-center gap-3 min-w-0">
                        <img
                            src={faviconUrls[0]}
                            alt={c.name}
                            className="w-8 h-8 rounded-sm bg-gray-100 dark:bg-gray-800"
                            onError={(e) => {
                                const img = e.currentTarget;
                                const index = Number(img.dataset.i || 0) + 1;

                                if (faviconUrls[index]) {
                                img.dataset.i = String(index);
                                img.src = faviconUrls[index];
                                }
                            }}
                        />

                        <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                            {c.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                            {c.domain}
                        </p>
                        </div>
                    </div>

                    {/* Right */}
                    {c.status === "suggested" && (
                        <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                            setCompetitorsData((prev) =>
                                prev.map((x) =>
                                x.id === c.id ? { ...x, status: "rejected" } : x
                                )
                            )
                            }
                        >
                            <X className="w-4 h-4 mr-1" />
                            Reject
                        </Button>

                        <Button
                            size="sm"
                            onClick={() =>
                            setCompetitorsData((prev) =>
                                prev.map((x) =>
                                x.id === c.id ? { ...x, status: "tracked" } : x
                                )
                            )
                            }
                        >
                            <Check className="w-4 h-4 mr-1" />
                            Track
                        </Button>
                        </div>
                    )}

                    {c.status === "tracked" && (
                        <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        Tracked
                        </span>
                    )}

                    {c.status === "rejected" && (
                        <span className="text-xs font-medium text-gray-400">
                        Rejected
                        </span>
                    )}
                    </div>
                );
                })}
            </div>
        )}
      
    </div>
  );
}