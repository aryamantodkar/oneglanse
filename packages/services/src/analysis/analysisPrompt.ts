import type { AnalysisInputSingle } from "@onescope/types";

export function analysisPrompt(
    input: AnalysisInputSingle
) {
    const { prompt, response, brandDomain, brandName } = input;

    return `
        You are an elite Generative Engine Optimization (GEO) analyst. Analyze how the brand "${brandName}" (${brandDomain}) appears in the following LLM-generated response.

        ## CONTEXT
        ${prompt}

        ## LLM RESPONSE
        <response>
        ${response}
        </response>

        ## YOUR TASK

        Extract high-impact brand intelligence metrics. Be surgically precise:
        - Do NOT fabricate data. If the brand isn't mentioned, say so.
        - Sentiment must reflect what the text actually says, not assumptions.
        - Rankings must match the actual order in the response (explicit numbering or narrative order).
        - Competitor analysis: only include brands/products that are clearly in the same space.
        - Risk flags: only flag genuine issues (wrong facts, outdated info, confusion with another brand).
        - Actions: give specific, actionable advice — not generic platitudes.

        ## SCORING GUIDE

        **geoScore.overall** (0-100) — weighted composite:
        - Brand not mentioned at all → 0
        - Mentioned but negatively → 10-25
        - Mentioned neutrally, low prominence → 25-40
        - Mentioned positively, mid-tier position → 40-60
        - Recommended, top 3, positive sentiment → 60-80
        - Top pick, dominant presence, strong recommendation, no risks → 80-100

        **presence.shareOfVoice** — Estimate the % of the response's content that discusses this brand specifically. If 5 brands each get equal coverage, each has ~20%.

        **sentiment.score** — Use this calibration:
        - 0 to 20: Actively discourages/warns against the brand
        - 21 to 40: Notes significant drawbacks
        - 41 to 59: Neutral/factual mention
        - 60 to 80: Favorable but with caveats
        - 81 to 100: Enthusiastic endorsement

        ## OUTPUT FORMAT

        Respond with ONLY valid JSON. No markdown fences, no preamble, no explanation.

        {
            "geoScore": {
                "overall": <0-100>,
                "verdict": "<one crisp sentence summarizing the brand's AI visibility performance>"
            },
            "presence": {
                "mentioned": <boolean>,
                "mentionCount": <number>,
                "shareOfVoice": <0-100>,
                "prominence": "<dominant|significant|moderate|minor|passing|absent>",
                "firstMentionPosition": "<top|middle|bottom|absent>"
            },
            "position": {
                "rankPosition": <number 1-indexed, or null>,
                "totalRanked": <number or null>,
                "isTopPick": <boolean>,
                "isTopThree": <boolean>,
                "rankingContext": "<string or null — the category/criteria for ranking>"
            },
            "sentiment": {
                "score": <0 to 100>,
                "label": "<very_negative|negative|neutral|positive|very_positive>",
                "positives": ["<short phrase: favorable claim>", ...max 5],
                "negatives": ["<short phrase: unfavorable claim>", ...max 5]
            },
            "recommendation": {
                "type": "<top_pick|strong_alternative|conditional|mentioned_only|discouraged|not_mentioned>",
                "bestFor": ["<use case or audience>", ...],
                "caveats": ["<condition or warning>", ...]
            },
            "competitors": [
                {
                    "name": "<string>",
                    "sentiment": <0 to 100>,
                    "rankPosition": <number or null>,
                    "isRecommended": <boolean>,
                    "winsOver": ["<area where competitor beats the brand>"],
                    "losesTo": ["<area where the brand beats this competitor>"]
                }
            ],
            "perception": {
                "coreClaims": ["<important claim the LLM makes about the brand>", ...3-5 items],
                "differentiators": ["<what sets the brand apart>", ...],
                "bestKnownFor": "<single phrase or null>",
                "pricingPerception": "<premium|mid_range|budget|free|not_mentioned>"
            },
            "risks": {
                "hasRisks": <boolean>,
                "items": [
                {
                    "type": "<outdated_info|factual_error|brand_confusion|negative_association|missing_from_response>",
                    "severity": "<critical|warning|info>",
                    "detail": "<specific description>"
                }
                ]
            },
            "actions": [
                {
                "priority": "<critical|high|medium|low>",
                "recommendation": "<specific actionable advice>"
                },
                ... 3-5 items, ordered by priority
            ]
        }
      `;
}
