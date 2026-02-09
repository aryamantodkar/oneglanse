import type { AnalysisInputSingle } from "@onescope/types";

export function analysisPrompt(
    input: AnalysisInputSingle
) {
    const { response, sources, brandDomain, brandName } = input;

    return `
        You are a specialized brand monitoring AI. Your ONLY job is to analyze how a SPECIFIC BRAND is represented in LLM responses and compare it against competitors.

        TARGET BRAND TO MONITOR:
        - Brand Name: "${brandName}"
        - Brand Domain: "${brandDomain}"
        - Extract ALL data about this specific brand, including variations and product names
        - Track ALL competitors mentioned alongside this brand

        BRAND VARIATION DETECTION:
        You must detect and count ALL mentions of the target brand, including:
        - Exact brand name: "${brandName}"
        - Product variations: "${brandName} CRM", "${brandName} Marketing", etc.
        - Casual mentions: "their platform", "this tool" (when referring to ${brandName})
        - Parent/subsidiary references (if ${brandName} is a product of a larger company)
        
        CRITICAL RULES:
        1. ONLY extract information EXPLICITLY stated in the response text. Never infer or assume.
        2. The target brand "${brandName}" is your PRIMARY focus - extract everything about it
        3. Competitors are SECONDARY - only extract them for competitive comparison context
        4. Use exact quotes as evidence for every claim
        5. Track ALL types of mentions: direct, indirect, in sources, in citations

        BRAND NORMALIZATION FOR COMPETITORS:
        Normalize competitor brands to parent brand names only:
        - "HubSpot CRM" → "HubSpot"
        - "Zoho CRM" → "Zoho" 
        - "Freshsales" → "Freshworks"
        - "Salesforce Sales Cloud" → "Salesforce"
        - Remove "CRM", product names, and variations
        
        DO NOT normalize the target brand "${brandName}" - keep it exactly as provided.

        Extract brand intelligence from this LLM response. Return ONLY valid JSON matching the schema below.

        <response>
            ${response}
        </response>

        <sources>
            ${JSON.stringify(sources)}
        </sources>

        <schema>
            {
                "target_brand": {
                    "brand_name": "${brandName}",
                    "brand_website": "${brandDomain}",
                    
                    "brand_presence": {
                        "total_mentions": "number — total times target brand appears in ANY form (direct + indirect + source mentions)",
                        "direct_mentions": "number — explicit mentions of brand name in response text",
                        "indirect_mentions": "number — references via pronouns, 'this tool', 'their platform' when clearly referring to target brand",
                        "source_mentions": "number — times target brand appears in cited sources",
                        "product_mentions": {
                            "count": "number — mentions of specific products (e.g., 'HubSpot CRM', 'HubSpot Marketing')",
                            "products_named": ["string — specific product names mentioned"]
                        },
                        "mention_contexts": [
                            {
                                "mention_text": "string — exact text where brand is mentioned (10-20 words of context)",
                                "mention_type": "string — one of: direct | indirect | product | source_citation | comparison",
                                "character_position": "number — position in response"
                            }
                        ],
                        "first_mention_position": "number|null — character index of first appearance (null if not mentioned)",
                        "presence_strength": "string — one of: dominant_focus | major_presence | moderate_presence | minor_presence | barely_mentioned | not_mentioned"
                    },
                    
                    "visibility": {
                        "rank": "number|null — order of first appearance among ALL brands (1=first, 2=second, etc.) (null if not mentioned)",
                        "visibility_score": "number — 0-100 score of prominence (0 if not mentioned)",
                        "share_of_voice": "number — 0-100 percentage of how much this response focuses on target brand vs competitors",
                        "is_recommended": "boolean — true if explicitly recommended with phrases like 'I recommend', 'best option', 'start with'",
                        "recommendation_evidence": "string|null — exact quote showing recommendation",
                        "recommendation_strength": "string — one of: primary_choice | strong_option | among_options | mentioned_only | not_recommended | not_mentioned",
                        "placement": "string — one of: primary_recommendation | top_listed | listed | mentioned_in_passing | negative_mention | comparison_only | not_mentioned",
                        "in_conclusion": "boolean — appears in final paragraph/summary"
                    },
                    
                    "sentiment": {
                        "overall": "string — one of: positive | negative | mixed | neutral | not_mentioned",
                        "score": "number — 0-100 (0=very negative, 50=neutral, 100=very positive)",
                        "positive_signals": ["string — exact quotes showing positive sentiment about target brand"],
                        "negative_signals": ["string — exact quotes showing negative sentiment about target brand"],
                        "qualifiers": ["string — exact quotes showing caveats or limitations"],
                        "sentiment_summary": "string — 1-2 sentence summary of how the target brand is portrayed"
                    },
                    
                    "brand_narrative": {
                        "key_message": "string|null — main message about target brand in 1 sentence",
                        "features_highlighted": ["string — features/capabilities explicitly mentioned"],
                        "strengths_cited": ["string — specific strengths or advantages mentioned"],
                        "weaknesses_cited": ["string — specific weaknesses or disadvantages mentioned"],
                        "pricing": {
                            "mentioned": "boolean",
                            "details": "string|null — exact pricing text",
                            "positioning": "string|null — one of: free | budget | mid_range | premium | enterprise | null",
                            "price_sentiment": "string|null — how pricing is framed: value | expensive | competitive | unclear | null"
                        },
                        "target_audience": "string|null — who the response says this brand is for",
                        "unique_value_prop": "string|null — what makes this brand different/special according to response",
                        "use_cases_mentioned": ["string — specific use cases or scenarios where target brand is mentioned"]
                    },
                    
                    "competitive_intelligence": {
                        "total_competitors_mentioned": "number — count of competitor brands in response",
                        "direct_comparisons": [
                            {
                                "competitor_name": "string — normalized competitor name",
                                "competitor_website": "string — competitor domain",
                                "competitor_mention_count": "number — how many times this competitor is mentioned",
                                "comparison_type": "string — one of: head_to_head | alternative | inferior_to_target | superior_to_target | neutral_comparison",
                                "comparison_evidence": "string — exact quote showing comparison",
                                "target_brand_wins_on": ["string — areas where target brand is positioned better"],
                                "competitor_wins_on": ["string — areas where competitor is positioned better"],
                                "competitive_gap": "string|null — what the competitor does that target brand doesn't (according to response)"
                            }
                        ],
                        "competitive_positioning": "string — one of: market_leader | top_contender | solid_option | niche_player | underdog | not_positioned | not_mentioned",
                        "threats_identified": ["string — competitors positioned as superior alternatives to target brand"],
                        "opportunities_identified": ["string — gaps or weaknesses in competitors that target brand could exploit"]
                    },
                    
                    "source_analysis": {
                        "sources_citing_target": [
                            {
                                "source_domain": "string",
                                "source_url": "string",
                                "source_title": "string",
                                "cited_claim": "string — specific claim about target brand this source supports",
                                "source_sentiment": "string — one of: positive | negative | neutral",
                                "source_credibility": "string — one of: official | authoritative | third_party | user_generated | unknown"
                            }
                        ],
                        "official_brand_sources": "number — count of sources from target brand's own domain",
                        "authoritative_sources": "number — count of high-authority sources (major publications) citing target brand",
                        "third_party_validation": "boolean — true if independent sources validate target brand's claims"
                    }
                },
                
                "market_context": {
                    "category": "string|null — product category being discussed (e.g., 'CRM software', 'project management tools')",
                    "all_brands_mentioned": [
                        {
                            "brand_name": "string — normalized brand name",
                            "brand_website": "string",
                            "mention_count": "number",
                            "visibility_rank": "number",
                            "is_target_brand": "boolean"
                        }
                    ],
                    "target_brand_ranking": "number|null — where target brand ranks by visibility among all brands (1=most visible, null if not mentioned)",
                    "market_leaders_identified": ["string — brands positioned as market leaders in this response"],
                    "response_tone": "string — one of: buying_guide | comparison | review | educational | promotional | negative"
                },
                
                "action_items": {
                    "visibility_gap": "string|null — how to increase target brand visibility based on this response",
                    "messaging_opportunities": ["string — messages/claims competitors are using that target brand could adopt"],
                    "reputation_risks": ["string — negative perceptions or claims that need addressing"],
                    "content_gaps": ["string — features or benefits competitors mention that target brand should highlight"],
                    "competitive_threats": ["string — specific competitors gaining more visibility or better positioning"]
                }
            }
        </schema>

        BRAND PRESENCE STRENGTH:
        - dominant_focus: 50%+ of response is about target brand, clear primary focus
        - major_presence: 30-49% of response focuses on target brand, heavily featured
        - moderate_presence: 15-29% of response, solid coverage among several brands
        - minor_presence: 5-14% of response, brief but notable mention
        - barely_mentioned: <5% of response, passing reference only
        - not_mentioned: 0 mentions

        MENTION TYPE DETECTION:
        - direct: Brand name appears explicitly (e.g., "${brandName}")
        - indirect: Pronoun or generic reference when context makes it clear (e.g., "this platform" after mentioning ${brandName})
        - product: Specific product variation (e.g., "${brandName} CRM")
        - source_citation: Brand appears in source title, URL, or cited text
        - comparison: Brand mentioned within a comparison statement

        VISIBILITY SCORE (0-100):
        How prominently the target brand is featured:
        - 90-100: Primary recommendation, heavily featured, dominates response
        - 75-89: Strongly featured with detailed coverage
        - 60-74: Well-covered in main comparison
        - 40-59: Moderate mention with some detail
        - 20-39: Brief mention, limited detail
        - 0-19: Passing reference or not mentioned

        SHARE OF VOICE (0-100):
        Percentage of response focused on target brand vs competitors:
        Calculate as: (target_brand_mentions / total_brand_mentions) × 100
        - 80-100: Response primarily about target brand
        - 60-79: Target brand is major focus
        - 40-59: Equal focus with other brands
        - 20-39: More focus on competitors
        - 0-19: Minimal focus, competitors dominate

        SENTIMENT SCORE (0-100):
        Based ONLY on explicit language:
        - 0-20: Very negative (warnings, major criticism)
        - 21-40: Negative (more cons than pros)
        - 41-49: Slightly negative (lukewarm, concerns)
        - 50: Neutral (factual, no clear lean)
        - 51-60: Slightly positive (generally favorable)
        - 61-80: Positive (clearly favorable, recommended)
        - 81-100: Very positive (enthusiastic, standout choice)

        RECOMMENDATION STRENGTH:
        - primary_choice: "I recommend ${brandName}", "best option is ${brandName}", "start with ${brandName}"
        - strong_option: "top choice", "excellent option", "highly recommended" (among several)
        - among_options: Listed as viable option but not specifically recommended
        - mentioned_only: Appears but no recommendation or endorsement
        - not_recommended: Explicitly advised against or positioned negatively
        - not_mentioned: Target brand doesn't appear in response

        COMPARISON TYPE:
        - head_to_head: Direct feature/price comparison as equal alternatives
        - alternative: Mentioned as "also consider" or fallback option
        - inferior_to_target: Competitor positioned as worse than target brand
        - superior_to_target: Competitor positioned as better than target brand
        - neutral_comparison: Listed together without clear winner

        SOURCE CREDIBILITY:
        - official: From target brand's own domain (${brandDomain})
        - authoritative: Major publications, industry analysts, established review sites
        - third_party: Independent blogs, comparison sites, user reviews
        - user_generated: Forums, social media, Q&A sites
        - unknown: Cannot determine source credibility

        CRITICAL VALIDATION:
        ✓ brand_presence.total_mentions = direct_mentions + indirect_mentions + source_mentions + product_mentions
        ✓ If total_mentions = 0: presence_strength = "not_mentioned", visibility_score = 0
        ✓ All competitor brand names normalized to parent brand
        ✓ Every claim has supporting quote evidence
        ✓ Share of voice calculated accurately based on mention counts
        ✓ mention_contexts array captures at least top 5 mentions (or all if <5)
        ✓ Competitive gaps identify real opportunities from response
        ✓ Action items are specific and derived from the response content

        RESPONSE FORMAT:
        - Return ONLY valid JSON, no markdown, no preamble
        - Use exact quotes from response as evidence
        - Be brutally honest about competitive positioning
        - Track ALL mention types comprehensively
        - Focus on ACTIONABLE insights for brand monitoring
        - If target brand not mentioned, still return full schema with zeros/nulls/empty arrays
      `;
}