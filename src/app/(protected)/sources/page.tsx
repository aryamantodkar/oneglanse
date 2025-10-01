"use client";

import { api } from "@/trpc/react";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";

interface PromptResponse {
  id: string;
  prompt_id: string;
  user_id: string;
  workspace_id: string;
  model: string;
  modelProvider: string;
  response: string;
  citations: { title: string; url: string; cited_text?: string }[];
  sources: { title: string; url: string; page_age?: string }[];
  created_at: string;
}

interface CombinedLink {
  url: string;
  title?: string;
}

export default function Sources() {
  const [responses, setResponses] = useState<PromptResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<string>("All Models");
  const [activeTab, setActiveTab] = useState<"domains" | "urls">("domains");
  const [expandedUrl, setExpandedUrl] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspace") ?? "";

  const { data, isLoading } = api.prompt.fetchPromptResponses.useQuery(
    { workspaceId },
    { retry: 2, refetchOnWindowFocus: false }
  );

  useEffect(() => {
    if (data?.result) {
      const filtered = data.result.filter(
        (r: PromptResponse) =>
          (r.response && r.response.trim() !== "") ||
          (Array.isArray(r.citations) && r.citations.length > 0) ||
          (Array.isArray(r.sources) && r.sources.length > 0)
      );
      setResponses(filtered);
    }
    setLoading(false);
  }, [data]);

  const providers = useMemo(() => {
    const set = new Set(responses.map(r => r.modelProvider));
    return ["All Models", ...Array.from(set)];
  }, [responses]);

  const displayedResponses = useMemo(() => {
    if (selectedProvider === "All Models") return responses;
    return responses.filter(r => r.modelProvider === selectedProvider);
  }, [responses, selectedProvider]);

  // Combine sources and citations into unique URLs per response
  const combinedResponses = useMemo(() => {
    return displayedResponses.map(resp => {
      const allLinks: CombinedLink[] = [
        ...(resp.sources?.map(s => ({ url: s.url, title: s.title })) || []),
        ...(resp.citations?.map(c => ({ url: c.url, title: c.title || c.cited_text })) || [])
      ];

      // Remove duplicates per response
      const uniqueLinks = Array.from(new Map(allLinks.map(link => [link.url, link])).values());
      return { ...resp, combinedLinks: uniqueLinks };
    });
  }, [displayedResponses]);

  // Flatten all combinedLinks and remove duplicates globally for URLs tab
  const uniqueUrlRows = useMemo(() => {
    const urlMap = new Map<string, { resp: PromptResponse; link: CombinedLink }>();
    combinedResponses.forEach(resp => {
      resp.combinedLinks.forEach(link => {
        if (!urlMap.has(link.url)) {
          urlMap.set(link.url, { resp, link });
        }
      });
    });
    return Array.from(urlMap.values());
  }, [combinedResponses]);

  const domainsData = useMemo(() => {
    const domainMap = new Map<string, { urls: Set<string>; citationsCount: number }>();
  
    combinedResponses.forEach(resp => {
      resp.combinedLinks.forEach(link => {
        if (!resp.response || !resp.response.trim()) return; // only count links with responses
        try {
          const domain = new URL(link.url).hostname;
          if (!domainMap.has(domain)) {
            domainMap.set(domain, { urls: new Set(), citationsCount: 0 });
          }
          const entry = domainMap.get(domain)!;
          entry.urls.add(link.url);
  
          // Count citations that belong to this domain
          const linkCitations = resp.citations?.filter(c => {
            try { return new URL(c.url).hostname === domain; } catch { return false; }
          }) ?? [];
          entry.citationsCount += linkCitations.length;
        } catch {
          // ignore invalid urls
        }
      });
    });
  
    const totalUsedUrls = Array.from(domainMap.values()).reduce((acc, entry) => acc + entry.urls.size, 0);
  
    return Array.from(domainMap.entries()).map(([domain, entry]) => ({
      domain,
      avgCitations: entry.urls.size > 0 ? (entry.citationsCount / entry.urls.size).toFixed(1) : "0",
      usedPercent: totalUsedUrls > 0 ? Math.round((entry.urls.size / totalUsedUrls) * 100) : 0,
    }));
  }, [combinedResponses]);

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-gray-500 text-lg mb-2">Loading prompt responses...</p>
        <p className="text-gray-400 text-sm">This may take a few minutes depending on your data size.</p>
      </div>
    );
  }

  if (!responses.length) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-gray-500 text-lg mb-4">No prompt responses yet.</p>
        <Button onClick={() => router.back()}>← Go Back</Button>
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
              <Bot className="h-4 w-4 text-gray-500" />
              <SelectValue placeholder="Select Provider" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {providers.map(prov => (
              <SelectItem key={prov} value={prov}>{prov}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-4">
        <button
          className={`px-4 py-2 font-medium ${activeTab === "domains" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"}`}
          onClick={() => setActiveTab("domains")}
        >
          Domains
        </button>
        <button
          className={`px-4 py-2 font-medium ${activeTab === "urls" ? "border-b-2 border-blue-600 text-blue-600" : "text-gray-600"}`}
          onClick={() => setActiveTab("urls")}
        >
          URLs
        </button>
      </div>

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
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
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
        <div className="overflow-x-auto">
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Model</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {uniqueUrlRows.map(({ resp, link }) => (
                <TableRow
                  key={link.url}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setExpandedUrl(expandedUrl === link.url ? null : link.url)}
                >
                  <TableCell className="p-4 break-words">
                    <div className="flex flex-row items-center gap-4">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=32`}
                        alt="favicon"
                        className="w-5 h-5 rounded-sm"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="flex flex-col items-left gap-1">
                          <span className="font-medium">{link.title || "-"}</span>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-gray-400 hover:underline break-words"
                            onClick={(e) => e.stopPropagation()} // prevents row click toggle
                          >
                            {link.url}
                          </a>
                          {expandedUrl === link.url && resp.citations?.length ? (
                            <Card className="bg-gray-50 p-2 mt-1 text-sm">
                              {resp.citations.map((c, i) => c.cited_text && (
                                <p key={i} className="mb-1">{c.cited_text}</p>
                              ))}
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