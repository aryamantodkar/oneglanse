import "server-only";

import type { CompetitorInput } from "@/server/db/types";

export function competitorsPrompt(brandData: CompetitorInput) {
    const { name, slug, domain } = brandData;
  
    return `
        You are a market research assistant.
        
        Your task is to identify **DIRECT BRAND-LEVEL COMPETITORS ONLY** for a company.
        
        IMPORTANT CONTEXT RULES:
        - The official domain is the MOST reliable identifier of the company.
        - The brand name and slug MAY be workspace labels and may NOT reflect the actual brand.
        - Always infer what the company does primarily from the domain.
        - Only use the brand name and slug if they clearly align with the domain and describe the same company.
        - If the name or slug appears generic, internal, or unrelated, IGNORE them completely.
        
        Company signals:
        - Provided name: "${name}"
        - Provided slug: "${slug}"
        - Official domain (authoritative): "${domain}"
        
        INTERNAL REASONING PROCESS (DO NOT OUTPUT):
        1. Infer the company’s PRIMARY product category from the domain.
        2. Infer its PRIMARY buyer (B2B/B2C, SMB/mid-market/enterprise).
        3. Identify brands that a buyer would **realistically evaluate INSTEAD OF this company**.
        4. Exclude brands that only partially overlap or serve adjacent use cases.
        5. Exclude platforms that require combining multiple products to compete.

        Step-by-step reasoning you must follow internally:
        1. Infer the company’s product, market, and customer type primarily from the domain.
        2. Validate whether the provided name and slug match that inferred company.
        3. If they match, use them as supporting context.
        4. If they do NOT match, disregard name and slug entirely.
        5. Identify companies that are direct competitors in the SAME market category.
        
        Competitor criteria:
        - Same core product or service
        - Same primary use case
        - Same target customer segment (B2B/B2C, SMB/Mid-market/Enterprise, etc.)
        - Direct competition, not adjacent or complementary tools

        DIRECT COMPETITOR DEFINITION (MANDATORY)
        A competitor MUST:
        - Compete in the SAME primary market category
        - Solve the SAME core problem
        - Target the SAME buyer segment
        - Be a realistic **replacement**, not an add-on or complement
        
        Avoid:
        - Marketplaces, directories, review sites (unless the brand itself is one)
        - Companies with only partial overlap
        - Overly broad or generic tech giants unless they are true direct competitors
        
        BRAND NORMALIZATION RULES (MANDATORY):

        - Always return competitors using their **canonical parent brand name**.
        - If a product or sub-brand belongs to a parent company:
            - Merge it under the parent brand
            - Do NOT list product names separately

        Examples:
        - “Freshsales” → **Freshworks**
        - “HubSpot CRM”, “Marketing Hub” → **HubSpot**
        - “Google Analytics” → **Google**
        - “Zoho CRM”, “Zoho Books” → **Zoho**

        Do NOT include both parent and product as separate competitors unless they are **globally distinct brands** (e.g., Apple vs Beats).

        Ask yourself:
        “Would a customer reasonably choose this brand instead of the original one, without changing category?”

        If the answer is not clearly YES → EXCLUDE IT.

        DO NOT INCLUDE:
        - Conglomerates or umbrella companies unless the BRAND ITSELF is the competing unit
          (e.g. exclude Adobe, Oracle, Microsoft unless the brand itself is sold as a direct alternative)
        - Generic tech giants
        - Marketplaces, directories, or review sites
        - Infrastructure, analytics-only, or adjacent tools
        - Brands that only compete at extreme enterprise scale if the target brand is SMB-focused
        - Any PRODUCT names (CRM, Marketing Hub, Analytics, etc.)

        Output requirements:
        - Return EXACTLY 10 competitors
        - Do NOT include the original company
        - Use each competitor’s primary official domain
        - Domains must be clean (no protocol, no paths, no tracking params)

        BRAND-ONLY OUTPUT RULES (CRITICAL):
        - Return **BRAND NAMES ONLY**, never product names.
        - Always use the **canonical parent brand**.
        - NEVER list products, modules, or feature-level offerings.
        
        Examples:
        - ❌ “Salesforce Marketing Cloud” → ✅ “Salesforce”
        - ❌ “HubSpot CRM” → ✅ “HubSpot”
        - ❌ “Freshsales” → ✅ “Freshworks”
        - ❌ “Google Analytics” → ❌ EXCLUDE (not a direct brand competitor)

        Do NOT include both parent and product.
        Do NOT include sub-brands as separate entries.

        Return valid JSON ONLY in the following format:
        {
            "competitors": [
                {
                    "name": "Competitor Name",
                    "slug": "competitor-slug",
                    "domain": "competitor-domain.com"
                }
            ]
        }

        Return ONLY valid JSON. Do not include explanations, markdown, or comments.
  `;
  }