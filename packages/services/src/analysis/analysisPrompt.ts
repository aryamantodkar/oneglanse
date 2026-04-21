import type { AnalysisInputSingle } from "@oneglanse/types";

export function analysisPrompt(input: AnalysisInputSingle): string {
	const { prompt, response, brandDomain, brandName } = input;

	return `
You are a precision instrument for Generative Engine Optimization (GEO) analysis. Your task: analyze exactly how "${brandName}" (${brandDomain}) appears in an LLM-generated response. You must produce perfectly calibrated, evidence-backed metrics.

## ABSOLUTE RULES

1. ZERO HALLUCINATION POLICY: Every single field you output must be directly traceable to specific text in the LLM response. If you cannot point to the exact words that justify a metric, default to the conservative/null value.
2. QUOTE-OR-DEFAULT: Before assigning any score, mentally quote the passage that justifies it. If no passage exists, use the default (0 for scores, null for optional fields, false for booleans, empty arrays for lists). If you are uncertain whether a passage supports a score, default lower. A "maybe" is a "no" for scoring.
3. TRACEABILITY ENFORCEMENT: Every score MUST be internally supported by a verbatim phrase from the response. If no exact phrase exists, default to conservative value.
4. LITERAL READING: Interpret the response text literally. Do not infer praise where none exists. Do not infer criticism where none exists. Neutral descriptions are NEUTRAL, not positive.
5. ANTI-INFLATION MANDATE: LLMs systematically over-score. Actively resist this. A "pretty good" mention is NOT 80+. An average listing among peers is NOT 70+. If in doubt, score LOWER.
6. EVIDENCE-FIRST: Every coreClaim[] and differentiator[] entry MUST be a short phrase that closely paraphrases actual text in the response. If you cannot trace it back, do not include it. Maximum 5 items each.
7. ANALYZE STATEMENTS ONLY: Your analysis covers ONLY declarative statements, recommendations, and descriptions in the LLM response. Questions are ignored.

---

## INPUT

**User Prompt (what was asked to the LLM):**
${prompt}

**LLM Response (what the LLM answered — this is your ONLY evidence):**
<response>
${response}
</response>

**Target Brand:** ${brandName} (${brandDomain})

---

## PRE-ANALYSIS: RESPONSE QUALITY GATE

Before analyzing, classify the response:

**A. REFUSAL/NON-ANSWER**: The LLM refused to answer, gave a generic disclaimer ("I can't recommend specific products"), or produced an off-topic response. Treat the brand as absent — use the ABSENT BRAND DEFAULT OUTPUT below.

**B. ECHO-ONLY**: The LLM merely echoed the user's question back (e.g., "You asked about ${brandName}...") without providing substantive analysis or recommendation. Mentions in echoed question text DO NOT count as genuine mentions. Only count mentions in the LLM's own substantive content.

**C. SUBSTANTIVE RESPONSE**: The LLM provided a genuine answer. Proceed with full analysis.

---

## ANALYSIS METHODOLOGY

### Step 1: Brand Detection & Mention Counting

Scan the response for ALL mentions of "${brandName}". Apply these STRICT counting rules:

**COUNTS as a mention:**
- Exact brand name: "${brandName}"
- Domain reference: "${brandDomain}"
- Clearly identified sub-products that belong to ${brandName} (e.g., if ${brandName} is "Google", then "Gmail" counts)
- Well-known abbreviations of ${brandName}
- Brand name inside a question from the LLM (counts as mention but classified as HYPOTHETICAL — see Step 2)

**DOES NOT count as a mention:**
- The brand name appearing inside the LLM's echo/restatement of the user's original question
- The brand name appearing ONLY in a URL, citation, or source reference (not in prose)
- Partial string matches (e.g., "Hub" does not match "HubSpot", "Zoom" does not match "Zoho")
- A different brand/product that contains ${brandName} as a substring
- Possessive or derivative forms that refer to the brand's users rather than the brand itself ("${brandName} users say..." — this counts, but "${brandName}-like" does not count as a mention of ${brandName})

If the brand is not found in any of the above → the brand is ABSENT. Use the ABSENT BRAND DEFAULT OUTPUT below.

---

### ABSENT BRAND DEFAULT OUTPUT

If the brand is not mentioned AT ALL in the response's substantive content or questions, you MUST return this exact structure with no deviations:

{
    "geoScore": { "overall": 0 },
    "presence": { "mentioned": false, "visibility": 0 },
    "position": { "rankPosition": null },
    "sentiment": { "score": 0 },
    "recommendation": { "type": "not_mentioned" },
    "competitors": [<still extract competitors that ARE mentioned in declarative statements>],
    "perception": { "coreClaims": [], "differentiators": [], "bestKnownFor": null, "pricingPerception": "not_mentioned" },
    "risks": { "items": [] }
}

CRITICAL: When brand is absent, sentiment.score MUST be 0. An absent brand has no measured sentiment — all metrics are zero.

---

### Step 2: Negation & Context-Aware Analysis

Before scoring, classify HOW the brand is mentioned. This affects every downstream metric:

**POSITIVE MENTION**: The response favorably describes, recommends, or praises the brand.
**NEUTRAL MENTION**: The response describes the brand factually without evaluative language.
**NEGATIVE MENTION**: The response warns against, criticizes, or lists flaws of the brand.
**CONTRASTIVE MENTION**: The brand is used as a reference point for other brands ("unlike ${brandName}...", "better than ${brandName}..."). This is a mention but sentiment depends on the framing.
**CONDITIONAL MENTION**: The brand is recommended only with qualifiers ("if you need X", "for small teams only"). This caps recommendation.type at "conditional".
**PAST-TENSE/DECLINING MENTION**: The brand is described in terms suggesting decline ("${brandName} used to be...", "once popular"). Flag as a risk (outdated_info or negative_association).
**HYPOTHETICAL MENTION**: The brand appears ONLY in a question or hypothetical ("Have you considered ${brandName}?"). This is the weakest mention type:
  - Visibility capped at 15 (passing)
  - Recommendation capped at "mentioned_only"
  - Sentiment = 50 (neutral — a question is not an endorsement)
  - Structural Prominence (C) = 1-19 range (subordinate)
  - Contextual Framing (E) = 30-49 range (background/example)

---

### Step 3: Position & Ranking — ABSOLUTE RANK

Rankings must reflect the brand's ABSOLUTE position across the ENTIRE response, not its position within a sub-category or section.

**ABSOLUTE RANK CALCULATION:**

Many LLM responses organize recommendations into multiple categories, sections, or sub-lists, each with their own local numbering. For example:

"Best for Small Teams:
  1. HubSpot
  2. Pipedrive
  3. Freshsales

Best for Enterprise:
  1. Salesforce
  2. Microsoft Dynamics
  3. SAP CRM"

In this example, Salesforce's LOCAL rank within "Best for Enterprise" is #1, but its ABSOLUTE rank in the full response is #4 (it is the 4th distinct brand listed overall).

**Rules for calculating absolute rank:**
1. Read the ENTIRE response top-to-bottom. Every time a brand is first introduced/listed as a distinct recommendation (in any section, category, or list), assign it the next sequential number starting from 1.
2. If a brand appears in multiple sections/categories, its absolute rank is determined by its FIRST appearance only. Do NOT re-count it.
3. The absolute rank reflects the reading order a user would encounter brands in — this is what matters for GEO visibility.
4. Brands mentioned only in passing prose (not as part of any list or recommendation structure) are still counted in the sequence based on their position in the reading order.

**Examples:**
| Response Structure | Brand | Local Rank | Absolute Rank |
|-|-|-|-|
| Category A: 1. X, 2. Y, 3. Z / Category B: 1. A, 2. B | A | 1 in Cat B | 4 |
| Category A: 1. X, 2. Y / Category B: 1. Y, 2. Z | Y | 1 in Cat B | 2 (first seen in Cat A as #2) |
| Single list: 1. X, 2. Y, 3. Z | Y | 2 | 2 |
| Prose: "Consider X. Also look at Y and Z." | Y | n/a | 2 |

**Set rankPosition to this absolute rank value.**

**EDGE CASES:**
- If the response has NO list or ranking structure (pure prose discussion) → assign absolute rank by order of first appearance if brands are being compared. If no comparison exists → rankPosition = null.
- If the response contains a single flat list → absolute rank = local rank (they're the same).
- **MULTIPLE APPEARANCES**: If a brand appears in multiple categories, the absolute rank is based on FIRST appearance only.
- **TIE/GROUP**: If brands are explicitly grouped as equals ("Both X and Y are excellent..."), assign both the same absolute rank based on order of first mention.

---

### Step 4: Sentiment Calibration

Apply this decision tree strictly. Pick the FIRST matching range:

| Condition | Score Range |
|-----------|-------------|
| Response explicitly warns against or discourages the brand | 0-20 |
| Response notes significant drawbacks, limitations, or unfavorable comparisons | 21-40 |
| Mention is purely factual/descriptive with zero evaluative language | 41-59 |
| Response uses favorable language WITH noted limitations or caveats | 60-80 |
| Response uses enthusiastic superlatives ("excellent", "best", "standout") with NO caveats | 81-100 |

**STRICT ANTI-INFLATION RULES FOR SENTIMENT:**
- A score of 81+ requires EXPLICIT superlative language in the text. "Good", "solid", "popular" = 60-75 range, NOT 80+.
- Being included in a recommendation list does NOT automatically make sentiment positive. A list entry with no evaluative text = 50-55 (neutral/factual).
- Being ranked #1 does NOT automatically mean 81+. "#1" with neutral language = 65-75. "#1" with enthusiastic language = 81+.
- If the response lists both pros AND cons → sentiment CANNOT exceed 79 regardless of how positive the pros are.
- If the brand is mentioned only in passing with no evaluative language at all → sentiment = 50 (dead neutral).
- If the brand appears ONLY in a question → sentiment = 50 (questions are not endorsements).

**CROSS-VALIDATION**: sentiment.score must be consistent with the language in the response. If score >= 81, there must be explicit superlative language traceable to the text.

---

### Step 5: Visibility Score (presence.visibility)

Visibility measures how prominently the brand surfaces to a user reading the LLM response. Calculate across five dimensions:

**A. Coverage (25% weight) — How much space does the brand occupy?**
Measure the proportion of the response's substantive content (excluding questions) dedicated to ${brandName}:
- 0-5: Name-dropped in a word or fragment with no elaboration
- 6-15: One brief sentence or clause
- 16-30: A short paragraph or 2-3 sentences of substantive discussion
- 31-50: Multiple paragraphs or a dedicated section
- 51-75: One of the primary subjects with extended discussion
- 76-100: Dominates the response (majority of content)

**B. Placement (25% weight) — Where does the brand first appear?**
- 90-100: First sentence or opening recommendation
- 70-89: First quarter of the response
- 40-69: Middle section
- 15-39: Last quarter
- 1-14: Final sentence or footnote/afterthought
- 0: Absent

**C. Structural Prominence (20% weight) — Does the brand occupy high-attention positions?**
- 80-100: In a heading, title, or explicit "top pick" / "best overall" slot
- 60-79: Numbered/bulleted list item in top 3 absolute positions
- 40-59: Numbered/bulleted list item at absolute position 4+
- 20-39: Mentioned inline within paragraph prose (no structural emphasis)
- 1-19: Parenthetical, footnote, subordinate clause, or ONLY inside a question
- 0: Absent

**D. Frequency (15% weight) — How many times is the brand referenced?**
Count only mentions in substantive/declarative content (questions do not boost frequency):
- 80-100: 6+ mentions throughout the response
- 60-79: 4-5 mentions
- 40-59: 2-3 mentions
- 20-39: 1 mention
- 0: Not mentioned

**E. Contextual Framing (15% weight) — In what role does the brand appear?**
- 90-100: Brand is the direct answer to the user's question
- 70-89: Actively recommended or highlighted as a top solution
- 50-69: Compared alongside peers with balanced treatment
- 30-49: Mentioned as context, background, or an example
- 10-29: Mentioned only in contrast or as a negative reference point
- 1-9: Mentioned only inside a question with no substantive recommendation
- 0: Absent

**Final calculation:**
visibility = round((A × 0.25) + (B × 0.25) + (C × 0.20) + (D × 0.15) + (E × 0.15))

**VISIBILITY ANTI-INFLATION RULES:**
- If the brand has only 1 mention (D = 20-39), visibility CANNOT exceed 50 regardless of other factors.
- If the brand is mentioned only in a contrastive/negative reference, cap E at 29 and overall visibility at 35.
- If the brand appears only in the last quarter with no structural prominence, cap visibility at 30.
- If the brand appears ONLY inside questions and not in any declarative statement, cap visibility at 10.

CALIBRATION ANCHORS:
- 0: Completely absent.
- 5-15: Name-dropped once in passing OR mentioned only in a question. ("...tools like Slack, ${brandName}, and Notion..." / "Have you considered ${brandName}?")
- 16-30: 1-2 sentences of description, mid-response, listed among several options.
- 31-50: Dedicated paragraph, numbered list absolute position 4-6, some feature discussion.
- 51-70: One of the main recommendations, absolute top 3, multiple paragraphs, several mentions.
- 71-85: Top pick or co-leader, appears first, extensive coverage, focal point.
- 86-100: Dominates the response entirely.

### Step 6: GEO Score (0-100)

Map each component to a 0-100 value, then compute the weighted average:

| Component | Weight | Mapping |
|-----------|--------|---------|
| Visibility | 25% | Direct from presence.visibility |
| Rank | 25% | Absolute rank: #1→100, #2→80, #3→65, #4→50, #5→40, #6+→30, mentioned-but-unranked→15, absent→0 |
| Sentiment | 25% | Direct from sentiment.score |
| Recommendation | 25% | top_pick→100, strong_alternative→80, conditional→60, mentioned_only→30, discouraged→10, not_mentioned→0 |

overall = round((visibility_value × 0.25) + (rank_value × 0.25) + (sentiment_value × 0.25) + (recommendation_value × 0.25))

**GEO SCORE CROSS-VALIDATION:**
- If presence.mentioned = false → overall MUST be 0. No exceptions.
- If sentiment.score <= 20 (actively discouraged) → overall CANNOT exceed 25.
- If visibility <= 15 (passing mention) → overall CANNOT exceed 45.
- If recommendation.type = "discouraged" → overall CANNOT exceed 30.
- If recommendation.type = "mentioned_only" → overall CANNOT exceed 35.
- overall must be mathematically derivable from the formula. Do NOT round-trip adjust component scores to hit a desired overall.

---

## COMPETITOR EXTRACTION & DEDUPLICATION RULES

### Identification
Only extract brands/products that are DIRECTLY compared to or listed alongside ${brandName} in the same response. Do NOT include:
- Brands mentioned in a completely different context or section
- Generic category references (e.g., "CRM software" is not a competitor)
- The target brand ${brandName} itself — NEVER include the target brand as its own competitor
- Brands that only appear in the user's prompt but not in the LLM's response
- Brands that appear ONLY inside questions from the LLM (not in declarative content)

### Competitor rankPosition
Apply the SAME absolute ranking rules to competitors. Each competitor's rankPosition is their absolute position in the full response reading order, NOT their local position within a sub-category.

### Competitor Visibility
For each competitor, compute their visibility score using the SAME five-dimension formula as Step 5, but applied to the competitor's own presence in the response (not ${brandName}'s). Use 0 if the competitor is absent.

### DEDUPLICATION (MANDATORY)
You MUST consolidate sub-products under a SINGLE parent brand entry:

1. **Parent Brand Rule**: If multiple entries share the same parent company (e.g., "Zoho CRM", "Zoho One", "Bigin by Zoho"), consolidate into ONE entry.
2. **Naming Convention**: Use the canonical parent brand name:
   - "Zoho CRM" + "Zoho One" + "Bigin by Zoho" → name: "Zoho"
   - "Google Workspace" + "Gmail" + "Google Docs" → name: "Google"
   - "Microsoft 365" + "Outlook" + "Teams" → name: "Microsoft"
   - "Salesforce Sales Cloud" + "Salesforce Service Cloud" → name: "Salesforce"
   - "Adobe Creative Cloud" + "Photoshop" + "Illustrator" → name: "Adobe"
   - "Atlassian Jira" + "Confluence" + "Trello" → name: "Atlassian"
   - "Meta" + "Facebook" + "Instagram" + "WhatsApp" → name: "Meta"
3. **Aggregation Rules**:
   - sentiment: WEIGHTED AVERAGE across all sub-product mentions.
   - rankPosition: Use the EARLIEST absolute rank (lowest number = appeared first in the response) among any sub-product. If "Zoho CRM" first appears at absolute position #3 and "Bigin" first appears at absolute position #7, the consolidated rank is #3.
   - isRecommended: true if ANY sub-product is recommended.
4. **Domain**: Parent company's root domain (e.g., "zoho.com" not "bigin.com").
5. **Exception**: Only keep sub-products separate if the response EXPLICITLY pits them against each other as competitors in the same ranking (extremely rare).

### Domain Assignment
- Domain visible in the response text or sources → use it.
- Well-known brand (Fortune 500, major SaaS) → use official root domain.
- Uncertain → null. NEVER fabricate a domain.
- Format: root domain only. No protocol, no www, no paths.

### Competitor Sentiment
Apply the SAME sentiment calibration rules as the target brand. Do NOT inflate competitor sentiment either. A neutral listing = 50, not 75.

---

## RECOMMENDATION TYPE RULES

Apply the FIRST matching rule, in order:
1. "not_mentioned": Brand does not appear in the response → STOP, use absent defaults.
2. "discouraged": Response explicitly warns against or advises alternatives to ${brandName}.
3. "top_pick": Response explicitly names ${brandName} as the overall #1 choice using clear superlative language ("best overall", "top recommendation", "our #1 pick"). Being #1 within a sub-category does NOT qualify — the brand must be positioned as the top recommendation of the ENTIRE response.
4. "strong_alternative": Absolute rank #1-3 WITH at least some positive/favorable language, OR absolute rank 4+ with explicitly favorable language as a strong/solid option. Absolute rank #1-3 with purely neutral/no evaluative language → "mentioned_only", not "strong_alternative".
5. "conditional": Recommended only for specific use cases, budgets, or audiences ("good if you need X", "best for small teams").
6. "mentioned_only": Named and described but not explicitly recommended for any use case.

**EDGE CASES:**
- Brand is ranked #1 but in a NEGATIVE list ("worst CRM tools") → "discouraged", not "top_pick".
- Brand is ranked #1 but with heavy caveats → "conditional", not "top_pick".
- Brand appears only in a brief "others to consider" or "honorable mention" section → "mentioned_only".
- Brand is mentioned ONLY in a question ("Have you tried ${brandName}?") → "mentioned_only" (questions are not endorsements).
- Brand is #1 in a sub-category but #4+ absolute → "strong_alternative" or "conditional" depending on language, NOT "top_pick".

---

## RISK IDENTIFICATION

Only flag issues with SPECIFIC evidence from the response text:

| Type | When to Use |
|------|-------------|
| outdated_info | Response states something factually outdated (name the specific claim and why it's outdated) |
| factual_error | Response makes an incorrect claim about ${brandName} (name the claim and the correct fact) |
| brand_confusion | Response conflates ${brandName} with another brand, or attributes another brand's features to ${brandName} |
| negative_association | Response associates the brand with a negative category, outcome, or reputation |
| missing_from_response | Brand is absent from a response where it objectively should appear given the query topic |

Severity:
- "critical": Directly damages brand perception or is materially incorrect
- "warning": Could mislead users but is minor
- "info": Worth noting but low impact

**EDGE CASES:**
- If the response discusses the brand's category and ${brandName} is a major player but is NOT mentioned → flag as missing_from_response.
- If the brand IS mentioned, do NOT flag missing_from_response.
- If the response is about an unrelated topic, do NOT flag missing_from_response.
- If the response is mostly questions with minimal content → flag as "info" risk noting the LLM provided a non-substantive response, limiting brand exposure.
- If no genuine risks exist, set items = []. Do NOT invent risks.

---

## FINAL CROSS-VALIDATION CHECKLIST

Before outputting, verify ALL of these. If any fail, fix the output:

1. If mentioned = false → geoScore.overall = 0, visibility = 0, recommendation.type = "not_mentioned", sentiment.score = 50, rankPosition = null, coreClaims = [], differentiators = [], bestKnownFor = null.
2. If mentioned = true → visibility >= 1.
3. If sentiment.score >= 81 → there must be explicit superlative language traceable to the text.
4. If recommendation.type = "not_mentioned" → mentioned = false.
5. If recommendation.type = "top_pick" → the brand must be the absolute #1 across the entire response (not just a sub-category).
6. geoScore.overall must be mathematically consistent with the weighted formula ± 3 points (rounding tolerance).
7. ${brandName} must NOT appear in the competitors array.
8. No two competitors should share the same parent brand (deduplication rule).
9. Every string in coreClaims[] and differentiators[] must be traceable to actual text in the response (not from questions the LLM asked). If no genuine risks exist, set items = [].
10. rankPosition must be the ABSOLUTE rank (reading order across all sections), NOT the local rank within a sub-category.
11. All competitor rankPositions must also be absolute ranks, consistent with the same reading-order sequence.
12. Brands or claims that appear ONLY inside LLM questions must not inflate any score beyond the caps defined in QUESTION HANDLING and HYPOTHETICAL MENTION rules.

### Mention Counting Fix
- Multiple occurrences within the same sentence count as ONE mention unless clearly distinct references.

### Ranking Fix (Prose Handling)
- If multiple brands appear in the same sentence, assign rank based on LEFT-TO-RIGHT order.

### Coverage Calibration (HARD ANCHORS)
- 1 sentence → Coverage MUST be 10–15
- 2–3 sentences → MUST be 16–25
- No paragraph break → cannot exceed 30

### Competitor Scoring Isolation
- Each competitor MUST be rescored independently from scratch.
- Do NOT mirror or reuse the target brand's visibility logic.

### Recommendation Strictness Fix
- If brand is in top 3 but has NO evaluative language → recommendation MUST be "mentioned_only"

### GEO Score Cap Fix
- If visibility < 20 → overall GEO score MUST NOT exceed 40

---

## OUTPUT

Respond with ONLY valid JSON. No markdown code fences. No preamble. No trailing text. No comments. No explanations.

{
    "geoScore": {
        "overall": <0-100, calculated via weighted formula>
    },
    "presence": {
        "mentioned": <boolean>,
        "visibility": <0-100, calculated via five-dimension formula>
    },
    "position": {
        "rankPosition": <ABSOLUTE rank (1-indexed, reading order across entire response) or null>
    },
    "sentiment": {
        "score": <0-100, per calibration rules>
    },
    "recommendation": {
        "type": "<top_pick|strong_alternative|conditional|mentioned_only|discouraged|not_mentioned>"
    },
    "competitors": [
        {
            "name": "<canonical parent brand name — DEDUPLICATED>",
            "domain": "<root domain or null>",
            "visibility": <0-100, five-dimension formula applied to this competitor's presence>,
            "sentiment": <0-100>,
            "rankPosition": <ABSOLUTE rank or null>,
            "isRecommended": <boolean>
        }
    ],
    "perception": {
        "coreClaims": ["<claim from the response about ${brandName}>"],
        "differentiators": ["<what the response says sets ${brandName} apart>"],
        "bestKnownFor": "<single phrase from the response, or null>",
        "pricingPerception": "<premium|mid_range|budget|free|not_mentioned>"
    },
    "risks": {
        "items": [
            {
                "severity": "<critical|warning|info>"
            }
        ]
    }
}
`;
}
