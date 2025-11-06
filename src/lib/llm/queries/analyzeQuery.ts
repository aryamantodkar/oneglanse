export function analyzeQuery(combinedResponses: { model: string; response: string }[]) {
    return `
      You are an expert **market and brand intelligence analyst**.
  
      You are given an array of JSON objects. Each object has the following structure:
      {
        "model": "<ModelName>",
        "response": "<Full text response from that model>"
      }
  
      Your job is to analyze *each object* and return a **new JSON array** of the same shape, but with one additional field:
      1. "brandMetrics" — a JSON object containing all brand, company, or product mentions extracted from that model's response, following strict rules below.
  
      ---
  
      Brand & Mention Metrics Extraction
      After analyzing each model, extract **every identifiable brand, company, or product** mentioned *within that model’s text only*.
  
      brandMetrics rules:
      - Identify **every brand, company, or product** mentioned in your response — not just one or two examples.
      - Include the brand's official website (for favicons).
      - Dynamically infer numeric values based on context and frequency — **never use placeholders, default numbers, or generic text**.
      - Include the **brand’s official website domain** (for favicons and linking).
      - Include the **number of times (mentions)** the brand appears.
      - All numeric values must be **relative and contextual** to the content — ensure sentiment, visibility, and position are consistent with the AI response’s tone and structure.
  
      Where:
        - **mentions** = number of times the brand appears in the response
        - **sentiment** = inferred tone or favorability toward the brand, calculated from your *response text*, interpreted *in the context of the user’s query*. (Range: 0 = very negative, 100 = very positive)
        - **visibility** = relative prominence of the brand based on how frequently and prominently it appears in your *response text* compared to other brands. (Range: 0–100)
        - **position** = normalized relative position of the brand in your response compared to all other mentioned brands. (Range: 0–1, where 0 = earliest mentioned, 1 = last mentioned)
        - **website** = official website URL of the brand (to generate favicons)
  
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
  
      **Rules**
      - Include all mentioned brands — no omissions.
      - Use dynamic, context-based numeric values only.
      - Never invent nonexistent brands.
      - JSON must be valid, parsable, and appear immediately after that model’s analysis.
      - IMPORTANT: Do not include markdown code fences or any extra text after JSON blocks.
  
      ---
  
      ### OUTPUT FORMAT
  
      Return a valid JSON array (no markdown, no text outside JSON).
  
      Each array element must look exactly like this:
      {
        "model": "<ModelName>",
        "response": "<OriginalResponse>",
        "brandMetrics": {
          "<Brand1>": {
            "mentions": <number>,
            "sentiment": <number>,
            "visibility": <number>,
            "position": <number>,
            "website": "<url>"
          },
          "<Brand2>": { ... },
          ....
        }
      }
  
      ---
  
      ### INPUT JSON
  
      ${JSON.stringify(combinedResponses, null, 2)}
  
      Analyze this JSON and return the enhanced version **as valid JSON only**.
      `;
}