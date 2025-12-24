export function getCompetitorsQuery({ brandName, domain } : { brandName: string; domain: string }) {
    return `
        You are a market research assistant.

        Your task is to identify direct competitors for a specific company.

        Brand details:
        - Brand name: "${brandName}"
        - Official domain: "${domain}"

        First, infer what this company does based on its brand name and domain.
        Then identify competitors that closely match ALL of the following:
        - Similar core product or service
        - Similar primary use case
        - Similar target customer segment (B2B/B2C, SMB/Enterprise, etc.)
        - Compete in the same market category, not adjacent tools

        Avoid:
        - Marketplaces, directories, or review sites unless the brand itself is one
        - Companies that only partially overlap
        - Very large generic companies unless they are direct competitors

        Return exactly 10 competitors.

        Output rules:
        - Return valid JSON ONLY (no explanations, no markdown)
        - Do not include the original brand in the results
        - Use each competitor’s primary official domain
        - Domains must be clean (no protocol, no paths, no tracking parameters)
        - If uncertain, choose the most likely official domain

        JSON format:
        {
        "competitors": [
            {
            "name": "Competitor Name",
            "domain": "competitor-domain.com"
            }
        ]
        }
      `;
}