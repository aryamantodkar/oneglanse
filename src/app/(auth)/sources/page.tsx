// "use client";

// import { useEffect, useState, useMemo, Fragment } from "react";
// import { useSearchParams } from "next/navigation";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
// import { Bot, ChevronRight, Link } from "lucide-react";
// import { fetchPromptResponses } from "@/lib/helper/mutations";
// import type { PromptResponseClient } from "@/server/db/types";
// import { getDomain, getModelFavicon } from "@/lib/helper/functions";
// import React from "react";

// export default function Sources() {
//   const [responses, setResponses] = useState<PromptResponseClient[]>([]);
//   const [selectedProvider, setSelectedProvider] = useState<string>("All Models");
//   const [activeTab, setActiveTab] = useState<"domains" | "urls">("domains");
//   const [openUrl, setOpenUrl] = useState<string | null>(null);

//   const searchParams = useSearchParams();
//   const workspaceId = searchParams.get("workspace") ?? "";

//   const { data: promptResponses, refetch, isLoading, error } = fetchPromptResponses(workspaceId);
  
//   useEffect(() => {
//     if (workspaceId) {
//       refetch(); 
//     }
//   }, [workspaceId, refetch]);

//   useEffect(() => {
//     if (!isLoading && Array.isArray(promptResponses?.data)) {
//       const filtered = (promptResponses.data as PromptResponseClient[]).filter(
//         (r) => Array.isArray(r.extracted_urls) && r.extracted_urls.length > 0
//       );
//       setResponses(filtered);

//       console.log("promptResponses",promptResponses.data);
//     }
//   }, [promptResponses, isLoading]);

//   const providers = useMemo(() => {
//     const set = new Set(responses.map(r => r.model_provider));
//     return ["All Models", ...Array.from(set)];
//   }, [responses]);

//   const displayedResponses = useMemo(() => {
//     if (selectedProvider === "All Models") return responses;
//     return responses.filter(r => r.model_provider === selectedProvider);
//   }, [responses, selectedProvider]);

//   const uniqueUrlRows = useMemo(() => {
//     const domainMap = new Map<
//       string,
//       {
//         domain: string;
//         rows: {
//           url: string;
//           resp: PromptResponseClient;
//           title?: string | null;
//           citedTexts: string[];
//         }[];
//       }
//     >();
  
//     displayedResponses.forEach((resp) => {
//       resp.extracted_urls.forEach((url) => {
//         const domain = getDomain(url);
  
//         const sourceTitle =
//           resp.sources?.find((s) => s.url === url)?.title ||
//           resp.citations?.find((c) => c.url === url)?.title ||
//           null;
  
//         const citedTexts =
//           resp.citations
//             ?.filter((c) => c.url === url && c.cited_text)
//             .map((c) => c.cited_text as string) || [];
  
//         if (!domainMap.has(domain)) {
//           domainMap.set(domain, { domain, rows: [] });
//         }
  
//         const domainRows = domainMap.get(domain)!.rows;
  
//         // Generate a unique key for this row: url + title + citedTexts joined
//         const rowKey = `${url}||${sourceTitle || ""}||${citedTexts.join("|")}`;
  
//         // Keep a Set of keys to avoid duplicates
//         if (!domainMap.get(domain)!.rows.some(r => `${r.url}||${r.title || ""}||${r.citedTexts.join("|")}` === rowKey)) {
//           domainRows.push({
//             url,
//             resp,
//             title: sourceTitle,
//             citedTexts,
//           });
//         }
//       });
//     });
  
//     return Array.from(domainMap.values()).sort((a, b) => b.rows.length - a.rows.length);
//   }, [displayedResponses]);

//   const domainsData = useMemo(() => {
//     const domainMap = new Map<string, { urls: string[]; citationCount: number }>();
  
//     displayedResponses.forEach(resp => {
//       resp.extracted_urls.forEach(url => {
//         try {
//           const domain = new URL(url).hostname;
//           if (!domainMap.has(domain)) {
//             domainMap.set(domain, { urls: [], citationCount: 0 });
//           }
//           domainMap.get(domain)!.urls.push(url); // push all occurrences
//           domainMap.get(domain)!.citationCount += 1;
//         } catch {
//           // ignore invalid URLs
//         }
//       });
//     });
  
//     const totalUrls = Array.from(domainMap.values()).reduce(
//       (acc, entry) => acc + entry.urls.length,
//       0
//     );
  
//     const totalCitations = Array.from(domainMap.values()).reduce(
//       (acc, d) => acc + d.citationCount,
//       0
//     );
  
//     return Array.from(domainMap.entries()).map(([domain, entry]) => ({
//       domain,
//       citationShare:
//         totalCitations > 0
//           ? ((entry.citationCount / totalCitations) * 100).toFixed(1)
//           : "0",
//       avgCitations:
//         entry.urls.length > 0
//           ? (entry.citationCount / entry.urls.length).toFixed(1)
//           : "0",
//       usedPercent:
//         totalUrls > 0
//           ? Math.round((entry.urls.length / totalUrls) * 100)
//           : 0,
//     })).sort((a, b) => b.usedPercent - a.usedPercent);
//   }, [displayedResponses]);

//   if (isLoading) {
//     return (
//       <div className="min-h-screen flex flex-col items-center justify-center">
//         <p className="text-gray-500 text-lg mb-2">Loading prompt responses...</p>
//         <p className="text-gray-400 text-sm">This may take a few minutes depending on your data size.</p>
//       </div>
//     );
//   }

//   if (!responses.length) {
//     return (
//       <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
//         <p className="text-gray-500 text-lg mb-2">No prompt responses yet.</p>
//         <p className="text-gray-400 text-sm mb-4">
//           If you’ve just added prompts, please check back in some time — processing can take a few minutes.
//         </p>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen p-8 space-y-6">
//       {/* Provider Select */}
//       <div className="flex items-center gap-4 mb-4">
//         <Select value={selectedProvider} onValueChange={setSelectedProvider}>
//           <SelectTrigger className="w-[220px]">
//             <div className="flex items-center gap-2">
//               <SelectValue placeholder="Select Provider" />
//             </div>
//           </SelectTrigger>
//           <SelectContent>
//             {providers.map((prov) => {
//               const icon = prov === "All Models" ? "" : getModelFavicon(prov);

//               return (
//                 <SelectItem key={prov} value={prov}>
//                   <div className="flex items-center gap-2">
//                   {prov === "All Models" ? (
//                       <Bot className="w-4 h-4 text-muted-foreground" />
//                     ) : (
//                       <img
//                         src={icon}
//                         alt={prov}
//                         className="w-4 h-4 rounded-sm"
//                       />
//                     )}
//                     <span>{prov}</span>
//                   </div>
//                 </SelectItem>
//               );
//             })}
//           </SelectContent>
//         </Select>
//       </div>

//       {/* Tabs */}
//       <div className="flex gap-4 border-b border-gray-200 mb-4">
//         <button
//           className={`px-4 py-2 font-medium ${
//             activeTab === "domains"
//               ? "border-b-2 border-blue-600 text-blue-600"
//               : "text-gray-600"
//           }`}
//           onClick={() => setActiveTab("domains")}
//         >
//           Domains
//         </button>
//         <button
//           className={`px-4 py-2 font-medium ${
//             activeTab === "urls"
//               ? "border-b-2 border-blue-600 text-blue-600"
//               : "text-gray-600"
//           }`}
//           onClick={() => setActiveTab("urls")}
//         >
//           URLs
//         </button>
//       </div>

//       {/* Domains Table */}
//       {activeTab === "domains" ? (
//         <div className="overflow-x-auto">
//           <Table className="w-full">
//             <TableHeader>
//               <TableRow className="border-b">
//                 <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
//                   Domain
//                 </TableHead>
//                 <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
//                   Used (%)
//                 </TableHead>
//                 <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
//                   Avg citations / link
//                 </TableHead>
//                 <TableHead className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
//                   Share of citations
//                 </TableHead>
//               </TableRow>
//             </TableHeader>
      
//             <TableBody>
//               {domainsData.map((d, idx) => (
//                 <TableRow
//                   key={idx}
//                   className="hover:bg-gray-50 transition-colors"
//                 >
//                   <TableCell className="px-6 py-5 align-middle">
//                     <div className="flex items-center gap-4">
//                       <img
//                         src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=32`}
//                         alt=""
//                         className="w-6 h-6 rounded-md"
//                         onError={(e) =>
//                           ((e.target as HTMLImageElement).style.display = "none")
//                         }
//                       />
//                       <span className="text-sm font-medium text-gray-900">
//                         {d.domain}
//                       </span>
//                     </div>
//                   </TableCell>
      
//                   <TableCell className="px-6 py-5 align-middle text-sm text-gray-700">
//                     {d.usedPercent}%
//                   </TableCell>
      
//                   <TableCell className="px-6 py-5 align-middle text-sm text-gray-700">
//                     {d.avgCitations}
//                   </TableCell>
      
//                   <TableCell className="px-6 py-5 align-middle text-sm text-gray-700">
//                     {d.citationShare}%
//                   </TableCell>
//                 </TableRow>
//               ))}
//             </TableBody>
//           </Table>
//         </div>
//       ) : (
//         <div className="overflow-x-auto">
//           <Table className="w-full table-fixed">
//           <TableHeader>
//             <TableRow>
//               <TableHead className="w-full px-6 py-3 text-left font-medium text-gray-500">Source</TableHead>
//               <TableHead className="w-[220px] px-6 py-3 text-right font-medium text-gray-500">Providers</TableHead>
//             </TableRow>
//           </TableHeader>
//             <TableBody>
//               {uniqueUrlRows.map(({ domain, rows }) => {
//                 const isOpen = openUrl === domain;

//                 const providers = Array.from(
//                   new Set(rows.map((r) => r.resp.model_provider))
//                 );

//                 return (
//                   <React.Fragment key={domain}>
//                     <TableRow
//                       className="cursor-pointer hover:bg-gray-50 transition-colors"
//                       onClick={() => setOpenUrl(isOpen ? null : domain)}
//                     >

//                     <TableCell colSpan={1} className="px-6 py-5 w-full">
//                       <div className="flex items-center gap-4">
//                         <div className="flex items-center gap-2">
//                           <img
//                             src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
//                             className="w-6 h-6 rounded-md"
//                             alt=""
//                           />
//                         </div>

//                         <div className="flex flex-col gap-2">
//                           <span className="text-sm font-medium text-gray-900">{domain}</span>

//                           <div className="flex gap-2">
//                             <span className="bg-gray-100 text-gray-500 text-[10px] font-medium px-2 py-0.5 rounded-full">
//                               {rows.length} citation{rows.length > 1 ? "s" : ""}
//                             </span>
//                           </div>
//                         </div>
//                       </div>
//                     </TableCell>

//                       <TableCell className="w-[220px] px-6 py-5 align-middle">
//                         <div className="flex items-center justify-end gap-3">
//                           {!isOpen &&
//                             providers.slice(0, 4).map((provider) => (
//                               <img
//                                 key={provider}
//                                 src={getModelFavicon(provider)}
//                                 title={provider}
//                                 className="w-5 h-5 rounded-sm"
//                               />
//                             ))}

//                           {providers.length > 4 && !isOpen && (
//                             <span className="text-xs text-gray-400">
//                               +{providers.length - 4}
//                             </span>
//                           )}

//                           <ChevronRight
//                             className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
//                               isOpen ? "rotate-90" : ""
//                             }`}
//                           />
//                         </div>
//                       </TableCell>
//                     </TableRow>

//                     {isOpen &&
//                       rows.map(({ url, title, resp, citedTexts }, index) => (
//                         <TableRow
//                           key={`${url}-${index}`}
//                           className="bg-gray-50 hover:bg-gray-100 transition-colors"
//                         >
//                           <TableCell className="px-6 py-4 pl-12 align-top w-full">
//                             <div className="flex flex-col gap-2">
//                               <div className="flex items-center gap-2">
//                                 <Link className="w-3 h-3 text-gray-400 flex-shrink-0" />

//                                 <a
//                                   href={url}
//                                   target="_blank"
//                                   rel="noopener noreferrer"
//                                   className="text-sm font-medium text-gray-800 hover:underline"
//                                   onClick={(e) => e.stopPropagation()}
//                                 >
//                                   {title || "(No title available)"}
//                                 </a>
//                               </div>

//                               <span className="text-xs text-gray-500 break-all">
//                                 {url}
//                               </span>

//                               {citedTexts.length > 0 && (
//                                 <div className="mt-2 space-y-1">
//                                   {citedTexts.map((text, idx) => (
//                                     <div
//                                       key={idx}
//                                       className="text-xs text-gray-700 bg-white border rounded-md p-2"
//                                     >
//                                       “{text}”
//                                     </div>
//                                   ))}
//                                 </div>
//                               )}
//                             </div>
//                           </TableCell>

//                           <TableCell className="w-[220px] px-6 py-4 align-middle whitespace-nowrap">
//                             <div className="flex items-center gap-3 justify-end">
//                               <img
//                                 src={getModelFavicon(resp.model_provider)}
//                                 className="w-5 h-5 rounded-sm"
//                               />
//                               <span className="text-sm text-gray-800">
//                                 {resp.model_provider}
//                               </span>
//                             </div>
//                           </TableCell>
//                         </TableRow>
//                       ))}
//                   </React.Fragment>
//                 );
//               })}
//             </TableBody>
//           </Table>
//         </div>
//       )}
//     </div>
//   );
// }

export default function Sources() {
  return(
    <div>Hello world</div>
  )
}