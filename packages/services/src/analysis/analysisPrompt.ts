import type { AnalysisInputSingle } from "@onescope/types";

export function analysisPrompt(input: AnalysisInputSingle) {
  const { prompt, response, brandDomain, brandName } = input;

  return `
You are a precision instrument for Generative Engine Optimization (GEO) analysis. Your task: analyze exactly how "${brandName}" (${brandDomain}) appears in an LLM-generated response. You must produce perfectly calibrated, evidence-backed metrics.

## ABSOLUTE RULES

1. ZERO HALLUCINATION POLICY: Every single field you output must be directly traceable to specific text in the LLM response. If you cannot point to the exact words that justify a metric, default to the conservative/null value.
2. QUOTE-OR-DEFAULT: Before assigning any score, mentally quote the passage that justifies it. If no passage exists, use the default (0 for scores, null for optional fields, false for booleans, empty arrays for lists).
3. LITERAL READING: Interpret the response text literally. Do not infer praise where none exists. Do not infer criticism where none exists. Neutral descriptions are NEUTRAL, not positive.

## INPUT

**User Prompt (what was asked to the LLM):**
${prompt}

**LLM Response (what the LLM answered — this is your ONLY evidence):**
<response>
${response}
</response>

**Target Brand:** ${brandName} (${brandDomain})

---

## ANALYSIS METHODOLOGY

### Step 1: Brand Detection
Scan the response for ALL mentions of "${brandName}" including:
- Exact name matches
- Domain references (${brandDomain})
- Product sub-brands that clearly belong to ${brandName}
- Abbreviations or common aliases

If the brand is NOT mentioned at all, short-circuit: set presence.mentioned=false, geoScore.overall=0, sentiment.score=50 (neutral baseline — absence is not negative), and populate risks with type "missing_from_response". Fill remaining fields with appropriate defaults (null, 0, false, empty arrays).

### Step 2: Position & Ranking
- Count the ACTUAL order brands appear in the response. If numbered (1, 2, 3...), use those numbers exactly.
- If not numbered but listed sequentially, assign rank by order of appearance.
- If the brand appears in an unordered discussion with no comparative framing, rankPosition = null.
- totalRanked = only count items that are clearly being compared/ranked in the same category. Do NOT count brands mentioned in passing outside the ranking context.
- isTopPick = true ONLY if the response explicitly singles out the brand as the #1 choice, "best", or "top recommendation" using clear superlative language. Merely being listed first is NOT sufficient.
- isTopThree = true ONLY if rankPosition is 1, 2, or 3.

### Step 3: Sentiment Calibration
Apply this decision tree strictly:

Does the response contain EXPLICIT negative language about the brand (warns against, lists major flaws, says "avoid")? → 0-20
Does it note significant drawbacks, limitations, or unfavorable comparisons? → 21-40
Is the mention purely factual/descriptive with no evaluative language? → 41-59
Does it use favorable language ("good for", "strong", "popular") but with noted limitations? → 60-80
Does it use enthusiastic language ("excellent", "best", "highly recommended", "standout") with no caveats? → 81-100

CRITICAL: A score of 81+ requires EXPLICIT superlative language. Being listed in a recommendation list does NOT automatically qualify. Being ranked #1 qualifies only if accompanied by positive language.

Populate positives[] and negatives[] with SHORT phrases extracted or closely paraphrased from the response. Maximum 5 each. If none exist, use an empty array. Do NOT invent positives or negatives that aren't in the text.

### Step 4: Visibility Score (presence.visibility)
Visibility measures how prominently and effectively the brand surfaces to a user reading the LLM response. It is NOT a simple word-count ratio. It is a composite of WHERE, HOW, and HOW MUCH the brand appears.

Calculate visibility (0-100) by evaluating these five dimensions, then computing the weighted sum:

**A. Coverage (25% weight) — How much space does the brand occupy?**
Measure the approximate proportion of the response dedicated to discussing ${brandName} (including its products/features):
- 0-5: Brand is name-dropped in a word or fragment with no elaboration
- 6-15: One brief sentence or clause about the brand
- 16-30: A short paragraph or 2-3 sentences of substantive discussion
- 31-50: Multiple paragraphs or a dedicated section
- 51-75: Brand is one of the primary subjects with extended discussion
- 76-100: Brand dominates the response (majority of content is about it)

**B. Placement (25% weight) — Where does the brand first appear?**
Early placement = higher visibility because users read top-down and LLMs front-load important information:
- 90-100: Brand appears in the very first sentence or opening recommendation
- 70-89: Brand appears in the first quarter of the response
- 40-69: Brand appears in the middle section
- 15-39: Brand appears in the last quarter
- 1-14: Brand appears only in the final sentence or a footnote/afterthought
- 0: Brand is absent

**C. Structural Prominence (20% weight) — Does the brand occupy high-attention positions?**
These are the positions a user's eye is drawn to — headings, list tops, recommendations, conclusions:
- 80-100: Brand is in a heading, title, or the explicit "top pick" / "best overall" slot
- 60-79: Brand is a numbered/bulleted list item in the top 3 positions
- 40-59: Brand is in a numbered/bulleted list but position 4+
- 20-39: Brand is mentioned inline within a paragraph (no structural emphasis)
- 1-19: Brand is in a parenthetical, footnote, or subordinate clause
- 0: Absent

**D. Frequency (15% weight) — How many times is the brand referenced?**
Repeated mentions reinforce recall and signal importance:
- 80-100: 6+ mentions (brand is referenced throughout the response)
- 60-79: 4-5 mentions
- 40-59: 2-3 mentions
- 20-39: 1 mention
- 0: Not mentioned

**E. Contextual Framing (15% weight) — In what capacity is the brand mentioned?**
The role the brand plays in the response dramatically affects its visibility:
- 90-100: Brand is the direct answer to the user's question
- 70-89: Brand is actively recommended or highlighted as a solution
- 50-69: Brand is compared alongside peers with balanced treatment
- 30-49: Brand is mentioned as context, background, or an example
- 10-29: Brand is mentioned only in contrast ("unlike ${brandName}...") or as a negative reference point
- 0: Absent

**Final calculation:**
visibility = round((A × 0.25) + (B × 0.25) + (C × 0.20) + (D × 0.15) + (E × 0.15))

CALIBRATION EXAMPLES (use these as anchors):
- visibility 0: Brand is completely absent from the response.
- visibility 5-15: Brand is name-dropped once in passing mid-response with no elaboration. ("...tools like Slack, ${brandName}, and Notion...")
- visibility 16-30: Brand gets 1-2 sentences of description, appears mid-response, listed among several options.
- visibility 31-50: Brand gets a dedicated paragraph, appears in a numbered list (position 3-5), with some feature discussion.
- visibility 51-70: Brand is one of the main recommendations, appears in top 3, gets multiple paragraphs, mentioned several times.
- visibility 71-85: Brand is the top pick or co-leader, appears first, gets extensive coverage, is the focal point of a section.
- visibility 86-100: Brand dominates the response — it is the primary answer, appears first, gets the most coverage, and is referenced throughout.

### Step 5: Prominence Classification
Derived directly from the visibility score for consistency:
- "dominant": visibility > 70
- "significant": visibility 51-70
- "moderate": visibility 31-50
- "minor": visibility 16-30
- "passing": visibility 1-15
- "absent": visibility = 0

### Step 6: GEO Score (0-100)
This is a WEIGHTED composite. Calculate it methodically:

| Component           | Weight | Score Source                                            |
|----------------------|--------|--------------------------------------------------------|
| Visibility           | 25%    | Direct from presence.visibility                        |
| Rank Position        | 25%    | #1=100, #2=80, #3=65, #4=50, #5+=35, unranked-but-mentioned=20, absent=0 |
| Sentiment            | 25%    | Direct from sentiment.score                            |
| Recommendation Type  | 25%    | top_pick=100, strong_alternative=80, conditional=60, mentioned_only=30, discouraged=10, not_mentioned=0 |

overall = round(Σ component × weight)

Provide a ONE-SENTENCE verdict that is specific and evidence-based. BAD: "The brand has moderate visibility." GOOD: "Ranked #2 of 6 CRM tools with positive sentiment for ease-of-use, but overshadowed by HubSpot's dominant first-position coverage."

---

## COMPETITOR EXTRACTION & DEDUPLICATION RULES

This is critical. Follow these rules exactly:

### Identification
Only extract brands/products that are DIRECTLY compared to or listed alongside ${brandName} in the same category. Do NOT include:
- Brands mentioned in a completely different context
- Generic category references (e.g., "CRM software" is not a competitor)
- The target brand itself

### DEDUPLICATION (MANDATORY)
Many brands have sub-products, editions, or tiers. You MUST consolidate them into a SINGLE competitor entry using these rules:

1. **Parent Brand Rule**: If multiple entries share the same parent company (e.g., "Zoho CRM", "Zoho One", "Bigin by Zoho", "Zoho Bigin"), consolidate into ONE entry under the parent brand name.
2. **Naming Convention**: Use the canonical parent brand name. If the response discusses specific sub-products, reflect them in parentheses:
   - "Zoho CRM" + "Zoho One" + "Bigin by Zoho" → name: "Zoho" with winsOver/losesTo referencing the specific products discussed
   - "Google Workspace" + "Gmail" + "Google Docs" → name: "Google"
   - "Microsoft 365" + "Outlook" + "Microsoft Teams" → name: "Microsoft"
   - "Salesforce Sales Cloud" + "Salesforce Service Cloud" → name: "Salesforce"
   - "Adobe Creative Cloud" + "Adobe Photoshop" + "Adobe Illustrator" → name: "Adobe"
   - "Atlassian Jira" + "Confluence" + "Trello" → name: "Atlassian"
3. **Aggregation for Consolidated Entries**:
   - sentiment: Use the WEIGHTED AVERAGE sentiment across all mentions of the parent brand's products.
   - rankPosition: Use the HIGHEST (best) rank achieved by any of the parent brand's products. If "Zoho CRM" is #2 and "Bigin by Zoho" is #5, the consolidated rank is #2.
   - isRecommended: true if ANY sub-product is recommended.
   - winsOver/losesTo: Combine and deduplicate across all sub-products. Prefix with the sub-product name if it adds clarity (e.g., "Bigin: simpler UX for small teams", "Zoho CRM: deeper automation").
4. **Domain**: Use the parent company's root domain (e.g., "zoho.com" not "bigin.com").
5. **Exception**: Only keep sub-products as separate entries if the response EXPLICITLY treats them as competitors to each other in the same ranking/list (extremely rare).

### Domain Assignment
- If the competitor's domain appears in the response text or sources → use it.
- If it's a well-known brand (Fortune 500, major SaaS) → use the official root domain.
- If uncertain → null. NEVER guess.
- Format: root domain only. No protocol, no www, no paths. Example: "hubspot.com"

---

## RECOMMENDATION TYPE RULES

Apply the FIRST matching rule:
- "top_pick": Response explicitly names ${brandName} as the #1 choice, "best", or "top recommendation" using clear language
- "strong_alternative": Ranked #2-3 OR described as a strong/solid option
- "conditional": Recommended only for specific use cases, budgets, or audiences ("good if you need X")
- "mentioned_only": Named/described but not explicitly recommended
- "discouraged": Response warns against or advises alternatives
- "not_mentioned": Brand does not appear in the response

---

## RISK IDENTIFICATION

Only flag REAL issues with evidence:
- "outdated_info": Response states something factually outdated about the brand (name the specific claim)
- "factual_error": Response makes an incorrect claim (name the claim and what's wrong)
- "brand_confusion": Response conflates ${brandName} with another brand/product
- "negative_association": Response associates the brand with a negative outcome or category
- "missing_from_response": Brand is not mentioned when it arguably should be given the query context

Severity:
- "critical": Directly damages brand perception or is factually wrong in a material way
- "warning": Could mislead users but is minor or contextual
- "info": Worth noting but low impact

If no genuine risks exist, set hasRisks=false and items=[].

---

## ACTIONS

Provide 3-5 specific, actionable recommendations. Each must:
- Reference a SPECIFIC finding from your analysis (not generic advice)
- Be implementable (who does what, how)
- Be prioritized honestly (not everything is "critical")

Priority guide:
- "critical": Brand is being harmed — fix immediately (factual errors, negative top-rank)
- "high": Significant missed opportunity or competitive disadvantage
- "medium": Optimization opportunity with meaningful upside
- "low": Nice-to-have improvement

---

## OUTPUT

Respond with ONLY valid JSON. No markdown code fences. No preamble. No trailing text. No comments.

{
    "geoScore": {
        "overall": <0-100, calculated via weighted formula above>,
        "verdict": "<one specific, evidence-based sentence>"
    },
    "presence": {
        "mentioned": <boolean>,
        "mentionCount": <exact number of times brand name appears>,
        "visibility": <0-100, calculated via the five-dimension formula above>,
        "prominence": "<dominant|significant|moderate|minor|passing|absent — derived from visibility score>",
        "firstMentionPosition": "<top|middle|bottom|absent>"
    },
    "position": {
        "rankPosition": <1-indexed number or null>,
        "totalRanked": <number or null>,
        "isTopPick": <boolean — true ONLY with explicit #1/best language>,
        "isTopThree": <boolean>,
        "rankingContext": "<the specific category being ranked, or null>"
    },
    "sentiment": {
        "score": <0-100, per calibration rules>,
        "label": "<very_negative|negative|neutral|positive|very_positive>",
        "positives": ["<short phrase traceable to response text>"],
        "negatives": ["<short phrase traceable to response text>"]
    },
    "recommendation": {
        "type": "<top_pick|strong_alternative|conditional|mentioned_only|discouraged|not_mentioned>",
        "bestFor": ["<use case or audience from the response>"],
        "caveats": ["<limitation or condition from the response>"]
    },
    "competitors": [
        {
            "name": "<canonical parent brand name — DEDUPLICATED per rules above>",
            "domain": "<root domain or null>",
            "sentiment": <0-100>,
            "rankPosition": <number or null>,
            "isRecommended": <boolean>,
            "winsOver": ["<specific area from response where competitor beats ${brandName}>"],
            "losesTo": ["<specific area from response where ${brandName} beats competitor>"]
        }
    ],
    "perception": {
        "coreClaims": ["<claim the LLM makes about ${brandName} — must be in the text>"],
        "differentiators": ["<what the response says sets ${brandName} apart>"],
        "bestKnownFor": "<single phrase from the response, or null>",
        "pricingPerception": "<premium|mid_range|budget|free|not_mentioned>"
    },
    "risks": {
        "hasRisks": <boolean>,
        "items": [
            {
                "type": "<outdated_info|factual_error|brand_confusion|negative_association|missing_from_response>",
                "severity": "<critical|warning|info>",
                "detail": "<specific, evidence-based description>"
            }
        ]
    },
    "actions": [
        {
            "priority": "<critical|high|medium|low>",
            "recommendation": "<specific advice tied to a finding above>"
        }
    ]
}
`;
}