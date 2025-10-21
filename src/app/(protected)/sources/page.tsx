"use client";

import { api } from "@/trpc/react";
import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Bot } from "lucide-react";

interface PromptResponse {
  id: string;
  prompt_id: string;
  user_id: string;
  workspace_id: string;
  model: string;
  modelProvider: string;
  response: string;
  citations: any[];
  sources: any[];
  extractedUrls: string[];
  created_at: string;
}

export default function Sources() {
  const [responses, setResponses] = useState<PromptResponse[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("All Models");
  const [activeTab, setActiveTab] = useState<"domains" | "urls">("domains");
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const { data, isLoading, refetch } = api.prompt.fetchPromptResponses.useQuery(
    { workspaceId },
    { 
      retry: 2,
      refetchOnWindowFocus: false,
      enabled: !!workspaceId, 
    }
  );
  
  useEffect(() => {
    if (workspaceId) {
      refetch(); 
    }
  }, [workspaceId, refetch]);

  // ✅ Use extractedUrls directly from backend
  useEffect(() => {
    if (!isLoading && data?.result) {
      const filtered = data.result.filter(
        (r: PromptResponse) => Array.isArray(r.extractedUrls) && r.extractedUrls.length > 0
      );
      setResponses(filtered);
    }
  }, [data, isLoading]);

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
    const urlMap = new Map<string, { resp: PromptResponse; title?: string }>();
  
    displayedResponses.forEach(resp => {
      resp.extractedUrls.forEach(url => {
        if (!urlMap.has(url)) {
          // Try to find a matching title from sources or citations
          const sourceTitle =
            resp.sources?.find(s => s.url === url)?.title ||
            resp.citations?.find(c => c.url === url)?.title ||
            resp.citations?.find(c => c.url === url)?.cited_text ||
            null;
  
          urlMap.set(url, { resp, title: sourceTitle });
        }
      });
    });
  
    return Array.from(urlMap.entries()).map(([url, { resp, title }]) => ({
      url,
      resp,
      title,
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
          domainMap.get(domain)!.citationCount += resp.citations?.length || 0;
        } catch {
          // ignore invalid URLs
        }
      });
    });

    const totalUrls = Array.from(domainMap.values()).reduce(
      (acc, entry) => acc + entry.urls.size,
      0
    );

    return Array.from(domainMap.entries()).map(([domain, entry]) => ({
      domain,
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

  // ✅ Render
  return (
    <div className="min-h-screen p-8 space-y-6">
      {/* Provider Select */}
      <div className="flex items-center gap-4 mb-4">
        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
          <SelectTrigger className="w-[220px]">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-gray-500" />
              <SelectValue placeholder="Select Provider" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {providers.map(prov => (
              <SelectItem key={prov} value={prov}>
                {prov}
              </SelectItem>
            ))}
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
                <TableHead>Avg Citations</TableHead>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        // URLs Table
        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Model</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uniqueUrlRows.map(({ url, title, resp }) => (
                <TableRow
                  key={url}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedUrl(expandedUrl === url ? null : url)}
                >
                  <TableCell className="p-4 break-words">
                    <div className="flex flex-row items-center gap-4">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${
                          new URL(url).hostname
                        }&sz=32`}
                        alt="favicon"
                        className="w-5 h-5 rounded-sm"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div className="flex flex-col gap-1">
                        {/* Title */}
                        <span className="text-sm font-medium text-gray-800">
                          {title || "(No title available)"}
                        </span>

                        {/* URL */}
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-500 hover:underline break-words"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {url}
                        </a>

                        {/* Expand citations if any */}
                        {expandedUrl === url && resp.citations?.length ? (
                          <Card className="bg-gray-50 p-2 mt-1 text-sm">
                            {resp.citations.map(
                              (c: any, i: number) =>
                                c.cited_text && (
                                  <p key={i} className="mb-1">
                                    {c.cited_text}
                                  </p>
                                )
                            )}
                          </Card>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{resp.model}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}