import { getDomain } from "./getDomain";

export function getUniqueLinks(
    items: { title?: string; url?: string }[] = []
  ): { title: string; url: string }[] {
    const map = new Map<string, { title: string; url: string }>();
  
    for (const item of items) {
      if (!item?.url) continue;
  
      const domain = getDomain(item.url);
      if (!domain || map.has(domain)) continue;
  
      map.set(domain, {
        title: item.title || domain,
        url: item.url,
      });
    }
  
    return Array.from(map.values());
}