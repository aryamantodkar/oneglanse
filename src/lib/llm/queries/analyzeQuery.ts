import type { analysisData } from "@/server/db/types";

export function analyzeQuery(analysisData: analysisData) {
    return `
      You are an expert **market and brand intelligence analyst**.

      You are given a nested JSON object representing **multiple prompt runs over time**.
  
      STRUCTURE OF INPUT:

      {
        "<prompt_id>": {
          "<prompt_run_at>": [
            {
              "model_provider": "<ModelName>",
              "response": "<Full response text from that model>"
            }
          ]
        }
      }

      IMPORTANT:
      - Each **prompt_run_at** represents a distinct historical snapshot.
      - Brand metrics MUST be computed **independently for each prompt_run_at**.
      - DO NOT combine or average metrics across different dates.

  
      You MUST preserve:
      - prompt_id keys
      - prompt_run_at keys
      - array ordering
      - model_provider and response fields

      Your job is to analyze *each object* and return a **new JSON array** of the same shape, but with one additional field:
      1. "brandMetrics" — a JSON object containing all brand, company, or product mentions extracted from that model's response, following strict rules below.
  
      ---
  
      Brand & Mention Metrics Extraction
      After analyzing each model, extract **every identifiable brand, company, or product** mentioned *within that model’s text only*.
  
      brandMetrics rules:
      - Identify **every brand, company, or product** mentioned in your response — not just one or two examples.
      - Dynamically infer numeric values based on context and frequency — **never use placeholders, default numbers, or generic text**.
      - Include the **brand’s official website domain** (for favicons and linking).
      - Include the **number of times (mentions)** the brand appears.
      - All numeric values must be **relative and contextual** to the content — ensure sentiment, visibility, and position are consistent with the AI response’s tone and structure.
      - Merge sub-products under their **parent brand** unless clearly distinct.

      Where:
      - mentions:  
        Exact number of times the brand name (or merged variants) appears in the text.

      - sentiment (0–100):  
        Overall tone toward the brand based strictly on descriptive language used.  
        • Positive endorsement → higher  
        • Neutral mention → mid-range  
        • Critical or limiting language → lower  

      - visibility (0–100):  
        **Relative prominence within THIS response only**.
        - Visibility MUST be comparative.
        - The most dominant brand should have the highest value.
        - Secondary or incidental brands MUST have lower values.
        - NEVER assign 100 to all brands.
        - Do NOT use uniform or placeholder values.

      - position (integer):  
        The **ranked order** of the brand’s first substantive appearance in the response.
        - 1 = earliest brand mentioned
        - 2 = second earliest
        - 3 = third earliest
        - etc.
        - Position MUST be a positive integer.
        - Do NOT normalize or scale values.
        - Ordering must reflect the actual sequence of first meaningful mention.

      - website:  
        Official homepage domain of the brand.
  
      BRAND NORMALIZATION
  
      - If a brand’s **product or sub-brand** (e.g., “Freshsales” by “Freshworks”) appears, merge it under the **parent or main brand name** unless the context clearly treats them as separate brands.  
      - Always use the **canonical parent brand** as the JSON key.
      - Do not include both brand and product names separately unless they are distinctly recognized brands (e.g., “Apple” and “Beats”).
      - Combine metrics of duplicates (e.g., merge “Freshsales” metrics into “Freshworks”).
  
      CROSS-MODEL BRAND CONSISTENCY
  
      - Maintain **consistent brand naming across all models** in this batch.  
        Example:
          - If one model mentions “HubSpot CRM” and another mentions “HubSpot,” treat both as **“HubSpot”**.  
      - Use the **most canonical, widely recognized brand name** when standardizing (e.g., prefer “HubSpot” over “HubSpot CRM”).
      - Ensure that brand names are identical across all array entries for the same underlying brand.
      - If ambiguity exists, choose the parent brand.
  
      **Rules**
      - Include all mentioned brands — no omissions.
      - Use dynamic, context-based numeric values only.
      - Never invent nonexistent brands.
      - JSON must be valid, parsable, and appear immediately after that model’s analysis.
      - IMPORTANT: Do not include markdown code fences or any extra text after JSON blocks.
      - Do NOT include explanations, markdown, comments, or extra text.
      - Output ONLY the JSON.

      BRAND ROLE CLASSIFICATION (CRITICAL)

      Before computing metrics, classify each brand mention into ONE of the following roles:

      1. EVALUATED BRAND
        - The brand is directly discussed, reviewed, compared, or recommended
        - Appears in headings, numbered lists, or descriptive sections
        - These brands MUST be included in ranking logic

      2. REFERENCE-ONLY BRAND
        - The brand appears only as:
          • a citation
          • a source link
          • an example
          • a tool used for explanation
        - The brand is NOT evaluated as a solution

     RULES:
      • Reference-only brands MUST still appear in brandMetrics
      • Reference-only brands MUST:
        - Have lower visibility than evaluated brands
        - Be assigned positions AFTER all evaluated brands

      • Evaluated brands ALWAYS take precedence in ordering and prominence

      • Position assignment rules (STRICT):
        - Positions MUST be positive integers (1, 2, 3, …)
        - Evaluated brands are assigned positions FIRST
          • Start at position = 1
          • Order by first substantive evaluation in the response
        - Reference-only brands are assigned positions AFTER evaluated brands
          • Continue integer sequence without gaps
        - Do NOT normalize, scale, or convert positions to decimals
        - Do NOT reset positions per role
        - Do NOT skip or duplicate position values
      
      ---
  
      ### OUTPUT FORMAT
  
      Return a valid JSON array (no markdown, no text outside JSON).
  
      Preserve the input structure exactly, but enrich each model object:
      {
        "<prompt_id>": {
          "<prompt_run_at>": [
            {
              "model_provider": "<ModelName>",
              "response": "<Original response>",
              "brandMetrics": {
                "<BrandName>": {
                  "mentions": <number>,
                  "sentiment": <number>,
                  "visibility": <number>,
                  "position": <number>,
                  "website": "<url>"
                }
              }
            }
          ]
        }
      }
  
      ---
  
      ### INPUT JSON
  
      ${JSON.stringify(analysisData, null, 2)}
  
      Analyze the data and return the enhanced JSON **exactly in the same structure**, with brandMetrics added for each model and each prompt_run_at.
      `;
}