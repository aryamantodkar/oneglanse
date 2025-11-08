"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bot } from "lucide-react";
import { fetchPromptResponses } from "@/lib/helper/mutations";
import type { PromptResponseClient } from "@/server/db/types";
import { getModelFavicon } from "@/lib/helper/functions";

export default function Sources() {
  const [responses, setResponses] = useState<PromptResponseClient[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("All Models");
  const [activeTab, setActiveTab] = useState<"domains" | "urls">("domains");

  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const { data: promptResponses, refetch, isLoading, error } = fetchPromptResponses(workspaceId);
  
  useEffect(() => {
    if (workspaceId) {
      refetch(); 
    }
  }, [workspaceId, refetch]);

  useEffect(() => {
    if (!isLoading && Array.isArray(promptResponses?.data)) {
      const filtered = (promptResponses.data as PromptResponseClient[]).filter(
        (r) => Array.isArray(r.extractedUrls) && r.extractedUrls.length > 0
      );
      setResponses(filtered);
    }
  }, [promptResponses, isLoading]);

  // ✅ Provider dropdown
  const providers = useMemo(() => {
    const set = new Set(responses.map(r => r.modelProvider));
    return ["All Models", ...Array.from(set)];
  }, [responses]);

  const displayedResponses = useMemo(() => {
    if (selectedProvider === "All Models") return responses;
    return responses.filter(r => r.modelProvider === selectedProvider);
  }, [responses, selectedProvider]);

  // ✅ Flatten all URLs across responses
  const uniqueUrlRows = useMemo(() => {
    const urlMap = new Map<string, { resp: PromptResponseClient; title?: string, citedTexts: string[]  }>();
  
    displayedResponses.forEach(resp => {
      resp.extractedUrls.forEach(url => {
        if (!urlMap.has(url)) {
          // Try to find a matching title from sources or citations
          const sourceTitle =
            resp.sources?.find(s => s.url === url)?.title ||
            resp.citations?.find(c => c.url === url)?.title ||
            null;
  
            const citedTexts =
              resp.citations
                ?.filter((c) => c.url === url && c.cited_text)
                .map((c) => c.cited_text as string) || [];

          urlMap.set(url, { resp, title: sourceTitle, citedTexts });
        }
      });
    });
  
    return Array.from(urlMap.entries()).map(([url, { resp, title, citedTexts }]) => ({
      url,
      resp,
      title,
      citedTexts
    }));
  }, [displayedResponses]);

  // ✅ Group by domain for "Domains" tab
  const domainsData = useMemo(() => {
    const domainMap = new Map<string, { urls: Set<string>; citationCount: number }>();
    displayedResponses.forEach(resp => {
      resp.extractedUrls.forEach(url => {
        try {
          const domain = new URL(url).hostname;
          if (!domainMap.has(domain)) {
            domainMap.set(domain, { urls: new Set(), citationCount: 0 });
          }
          domainMap.get(domain)!.urls.add(url);
          domainMap.get(domain)!.citationCount += 1;
        } catch {
          // ignore invalid URLs
        }
      });
    });

    const totalUrls = Array.from(domainMap.values()).reduce(
      (acc, entry) => acc + entry.urls.size,
      0
    );

    const totalCitations = Array.from(domainMap.values())
    .reduce((acc, d) => acc + d.citationCount, 0);

    return Array.from(domainMap.entries()).map(([domain, entry]) => ({
      domain,
      citationShare:
        totalCitations > 0
          ? ((entry.citationCount / totalCitations) * 100).toFixed(1)
          : "0",
      avgCitations:
        entry.urls.size > 0
          ? (entry.citationCount / entry.urls.size).toFixed(1)
          : "0",
      usedPercent:
        totalUrls > 0
          ? Math.round((entry.urls.size / totalUrls) * 100)
          : 0,
    }));
  }, [displayedResponses]);

  // ✅ Loading / Empty UI
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
      {/* Provider Select */}
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

      {/* Tabs */}
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

      {/* Domains Table */}
      {activeTab === "domains" ? (
        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Used (%)</TableHead>
                <TableHead>Average Citations per Link</TableHead>
                <TableHead>Share of Citations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domainsData.map((d, idx) => (
                <TableRow key={idx} className="hover:bg-gray-50">
                  <TableCell className="flex items-center gap-2 p-4">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=32`}
                      alt="favicon"
                      className="w-5 h-5 rounded-sm"
                      onError={(e) =>
                        ((e.target as HTMLImageElement).style.display = "none")
                      }
                    />
                    {d.domain}
                  </TableCell>
                  <TableCell>{d.usedPercent}%</TableCell>
                  <TableCell>{d.avgCitations}</TableCell>
                  <TableCell>{d.citationShare}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Model</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uniqueUrlRows.map(({ url, title, resp, citedTexts }) => (
                <TableRow
                  key={url}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <TableCell className="p-4 align-top">
                    <div className="flex flex-col gap-2">
                      {/* Title + Favicon */}
                      <div className="flex items-center gap-2">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`}
                          alt="favicon"
                          className="w-5 h-5 rounded-sm"
                          onError={(e) =>
                            ((e.target as HTMLImageElement).style.display = "none")
                          }
                        />
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-gray-800 hover:underline truncate max-w-[750px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {title || "(No title available)"}
                        </a>
                      </div>

                      {/* URL */}
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:underline break-all truncate max-w-[600px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {url}
                      </a>

                      {/* Inline Cited Texts */}
                      {citedTexts && citedTexts.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {citedTexts.map((text, idx) => (
                            <div
                              key={idx}
                              className="text-xs text-gray-700 bg-gray-100 rounded-md p-2 border border-gray-200"
                            >
                              “{text}”
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="whitespace-nowrap align-top">
                    <span className="text-sm text-gray-800">{resp.model}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}