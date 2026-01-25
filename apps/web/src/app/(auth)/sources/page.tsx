"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bot, ChevronRight, ExternalLink, Info, Link, SearchX } from "lucide-react";
import type { Citation, CitationGroupResult, DomainResponseClient, DomainStats, GroupedCitation, ModelFilterDomainStats, PromptResponse } from "@/server/db/types";
import { getFaviconUrls, getModelFavicon } from "@/lib/ui/favicon";
import React from "react";
import { usePromptResponses } from "../prompts/_lib/queries/prompt.queries";

export default function Sources() {
  const [responses, setResponses] = useState<PromptResponse[]>([]);
  const [originalPromptResponses, setOriginalPromptResponses] = useState<PromptResponse[]>([]);
  const [domainStats, setDomainStats] = useState<ModelFilterDomainStats | null>(null);
  const [citationStats, setCitationStats] = useState<CitationGroupResult | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("All Models");
  const [activeTab, setActiveTab] = useState<"domains" | "urls">("domains");
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const { data: promptResponses, refetch, isLoading, error } = usePromptResponses(workspaceId);
  
  useEffect(() => {
    if (workspaceId) {
      refetch(); 
    }
  }, [workspaceId, refetch]);

  useEffect(() => {
    if (
      isLoading ||
      !promptResponses?.data ||
      !Array.isArray(promptResponses.data.responses) ||
      !promptResponses.data.domain_stats ||
      !Array.isArray(promptResponses.data.domain_stats.combined) ||
      !promptResponses.data.citationStats ||
      !Array.isArray(promptResponses.data.citationStats.combined)
    ) {
      return;
    }
    
    const domainStatistics: ModelFilterDomainStats = promptResponses?.data.domain_stats;
    const citationStatistics: CitationGroupResult = promptResponses?.data.citationStats;
      
    console.log("citationStatistics",citationStatistics);

    setResponses(promptResponses?.data?.responses);
    setOriginalPromptResponses(promptResponses?.data?.responses);
    setDomainStats(domainStatistics);
    setCitationStats(citationStatistics);
    // console.log("promptResponses",promptResponses.data);
  }, [promptResponses, isLoading]);

  const providers = useMemo(() => {
    const set = new Set(responses.map(r => r.model_provider));
    return ["All Models", ...Array.from(set)];
  }, [responses]);

  const displayedResponses = useMemo(() => {
    if (selectedProvider === "All Models") return responses;
    return responses.filter(r => r.model_provider === selectedProvider);
  }, [responses, selectedProvider]);

  const displayedDomainStats = useMemo(() => {
    if (selectedProvider === "All Models") return domainStats?.combined;
    return domainStats?.byModel[selectedProvider];
  }, [domainStats, selectedProvider]);

  const displayedCitationStats = useMemo(() => {
    if (selectedProvider === "All Models") return citationStats?.combined;
    return citationStats?.byModel[selectedProvider];
  }, [citationStats, selectedProvider]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-gray-500 text-lg mb-2">Loading prompt responses...</p>
        <p className="text-gray-400 text-sm">This may take a few minutes depending on your data size.</p>
      </div>
    );
  }

  if (!responses.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
        <p className="text-gray-500 text-lg mb-2">No prompt responses yet.</p>
        <p className="text-gray-400 text-sm mb-4">
          If you’ve just added prompts, please check back in some time — processing can take a few minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger className="w-[220px]">
            <div className="flex items-center gap-2">
              <SelectValue placeholder="Select Provider" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {providers.map((prov) => {
              const icon = prov === "All Models" ? "" : getModelFavicon(prov);

              return (
                <SelectItem key={prov} value={prov}>
                  <div className="flex items-center gap-2">
                  {prov === "All Models" ? (
                      <Bot className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <img
                        src={icon}
                        alt={prov}
                        className="w-4 h-4 rounded-sm"
                      />
                    )}
                    <span>{prov}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-4 border-b border-gray-200 mb-4">
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === "domains"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600"
          }`}
          onClick={() => setActiveTab("domains")}
        >
          Domains
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === "urls"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-600"
          }`}
          onClick={() => setActiveTab("urls")}
        >
          URLs
        </button>
      </div>

      {
        (activeTab === "domains" && !displayedDomainStats) || (activeTab === "urls" && !displayedCitationStats)
        ?
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <div className="
              mb-5
              flex items-center justify-center
              w-11 h-11
              rounded-full
              bg-gray-100
            ">
              <SearchX className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
            </div>

            <h3 className="text-md font-medium text-gray-900">
              No results found
            </h3>

            <p className="mt-1.5 text-sm text-gray-500 max-w-xs">
              {activeTab === "domains"
                ? "Try adjusting your filters to see source data."
                : "Try adjusting your filters to see citation data."}
            </p>
        </div>
        :
        activeTab === "domains" && displayedDomainStats ? (
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="px-4 py-4 w-[40px]" />
                  <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Domain
                  </TableHead>
                  <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Used (%)
                  </TableHead>
                  <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Avg citations / link
                  </TableHead>
                </TableRow>
              </TableHeader>
        
              <TableBody>
                {displayedDomainStats &&
                  displayedDomainStats.map((d, idx) => {
                    const faviconUrls = getFaviconUrls(d.domain ?? "", "");
                    
                    return (
                      <TableRow
                        key={d.domain}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <TableCell className="px-4 py-5 align-middle text-xs text-gray-400 w-[40px]">
                          {idx + 1}
                        </TableCell>
    
                        <TableCell className="px-6 py-5 align-middle">
                          <div className="flex items-center gap-4">
                            <img
                              src={faviconUrls[0]}
                              alt=""
                              className="w-6 h-6 rounded-md"
                              onError={(e) =>
                                ((e.target as HTMLImageElement).style.display = "none")
                              }
                            />
                            <a
                              href={`https://${d.domain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="
                                text-sm font-medium text-gray-900
                                hover:text-gray-700
                                transition-colors
                              "
                            >
                              {d.domain}
                            </a>
                          </div>
                        </TableCell>
    
                        <TableCell className="px-6 py-5 align-middle text-sm text-gray-700">
                          {d.usedPercentageAcrossAllDomains}%
                        </TableCell>

                        <TableCell className="px-6 py-5 align-middle text-sm text-gray-700">
                          {d.citationTextCount === 0 ? (
                            <div className="relative inline-block group">
                              <span className="text-xs text-gray-500 cursor-default">
                                Referenced by {selectedProvider}
                              </span>

                              <div
                                className="
                                  pointer-events-none
                                  absolute left-1/2 bottom-full z-20 mt-1
                                  -translate-x-1/2
                                  whitespace-nowrap
                                  rounded-md
                                  bg-gray-900
                                  px-3 py-2
                                  text-[11px]
                                  text-white
                                  opacity-0
                                  group-hover:opacity-100
                                  transition-opacity
                                "
                              >
                                This source was referenced, but no cited text was provided.
                              </div>
                            </div>
                          ) : (
                            d.avgCitationsPerDomain
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-full px-6 py-3 text-left font-medium text-gray-500">Source</TableHead>
                <TableHead className="w-[220px] px-6 py-3 text-right font-medium text-gray-500">Providers</TableHead>
              </TableRow>
            </TableHeader>
              <TableBody>
                {displayedCitationStats && displayedCitationStats.map((c, idx) => {
                  const faviconUrls = getFaviconUrls(c.url ?? "", "");
                  const isOpen = openUrl === c.url;
  
                  const providers = Array.from(
                    new Set(c.citations.map((r) => r.model_provider))
                  );

                  const hasOnlyReferences =
                      c.totalCitations ===
                      c.citations.filter(c => !c.cited_text?.trim()).length;
  
                  return (
                    <React.Fragment key={c.url}>
                      <TableRow
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setOpenUrl(isOpen ? null : c.url)}
                      >
  
                      <TableCell colSpan={1} className="px-6 py-5 w-full">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <img
                              src={faviconUrls[0]}
                              className="w-6 h-6 rounded-md"
                              alt=""
                            />
                          </div>
  
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-medium text-gray-900 line-clamp-1">
                              {c.title || "Untitled source"}
                            </span>
  
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500 break-all">
                                {c.url}
                              </span>

                              <a
                                href={c.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="
                                  inline-flex
                                  items-center
                                  justify-center
                                  rounded
                                  text-gray-400
                                  hover:text-gray-600
                                  transition-colors
                                "
                                title="Open source"
                              >
                                <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
                              </a>
                            </div>
  
                            <div className="flex gap-2 mt-1">
                              {hasOnlyReferences ? (
                                <span
                                  className="
                                    bg-gray-50
                                    text-gray-500
                                    text-[10px]
                                    font-medium
                                    px-2 py-0.5
                                    rounded-full
                                    border border-dashed border-gray-200
                                  "
                                >
                                  {c.totalCitations} Reference{c.totalCitations > 1 ? "s" : ""}
                                </span>
                              ) : (
                                <span
                                  className="bg-gray-100 text-gray-500 text-[10px] font-medium px-2 py-0.5 rounded-full"
                                >
                                  {c.totalCitations} Citation{c.totalCitations > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
  
                        <TableCell className="w-[220px] px-6 py-5 align-middle">
                          <div className="flex items-center justify-end gap-3">
                            {!isOpen &&
                              providers.slice(0, 4).map((provider) => provider && (
                                <img
                                  key={provider}
                                  src={getModelFavicon(provider)}
                                  title={provider}
                                  className="w-5 h-5 rounded-sm"
                                />
                              ))}
  
                            {providers.length > 4 && !isOpen && (
                              <span className="text-xs text-gray-400">
                                +{providers.length - 4}
                              </span>
                            )}
  
                            <ChevronRight
                              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                                isOpen ? "rotate-90" : ""
                              }`}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
  
                      {isOpen &&
                        c.citations.map(({ cited_text, model_provider }, index) => (
                          <TableRow
                            key={`${c.url}-citation-${index}`}
                            className="bg-transparent"
                          >
                            <TableCell className="px-6 py-6 pl-16 align-top w-full">
                              <div className="relative max-w-3xl">
                                <div
                                  className="
                                    absolute
                                    left-0
                                    top-1/2
                                    -translate-y-1/2
                                    h-[70%]
                                    w-[2px]
                                    bg-gradient-to-b
                                    from-transparent
                                    via-gray-200
                                    to-transparent
                                  "
                                />
  
                                <div
                                  className="
                                    absolute
                                    left-[-30px]
                                    top-1/2
                                    -translate-y-1/2
  
                                    w-5
                                    text-center
  
                                    text-[12px]
                                    font-medium
                                    text-gray-500
                                    tracking-tight
                                  "
                                >
                                  {index + 1}
                                </div>
  
                                <div className="pl-6 flex flex-col gap-3">
                                  {
                                    hasOnlyReferences
                                    ?
                                    <div className="text-[14px] leading-[1.65] italic text-gray-500">
                                      This source was referenced by the model, but no cited text was provided.
                                    </div>
                                    :
                                    <p className="text-[14px] leading-[1.65] italic text-gray-600">
                                      <span className="text-gray-300 mr-1">“</span>
                                      {cited_text}
                                      <span className="text-gray-300 ml-1">”</span>
                                    </p>
                                  }

                                  {model_provider && (
                                    <div className="flex items-center gap-2 text-[11px] text-gray-400">
                                      <img
                                        src={getModelFavicon(model_provider)}
                                        alt=""
                                        className="w-4 h-4 rounded-sm opacity-80"
                                      />
                                      <span className="tracking-wide">
                                        {model_provider}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
  
                            <TableCell className="w-[220px]" />
                          </TableRow>
                        ))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
    </div>
  );
}
