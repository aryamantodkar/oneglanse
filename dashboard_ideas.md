# Displaying Brand Intelligence Metrics — UI Architecture

Every field maps directly to a question a brand manager would actually ask:

| Category         | Brand Manager Question                                  |
|------------------|---------------------------------------------------------|
| GEO Score        | "How am I doing overall in AI search?"                  |
| Presence         | "Am I even showing up? How much space do I get?"        |
| Position         | "Where do I rank when people ask about my category?"    |
| Sentiment        | "Is the AI saying good or bad things about me?"         |
| Recommendation   | "Is the AI actually telling people to use my product?"  |
| Competitors      | "Who am I losing to and why?"                           |
| Perception       | "What narrative is AI building about my brand?"         |
| Risks            | "Is anything factually wrong that I need to fix?"       |
| Actions          | "What should I do right now?"                           |

## Dashboard Layout (Top → Bottom)

### 1. Hero Section — The Score

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│         ╭───────╮                                   │
│         │  73   │  GEO Score                        │
│         ╰───────╯                                   │
│                                                     │
│  "Recommended as a strong alternative but losing    │
│   the pricing narrative to Competitor X"            │
│                                                     │
│  ChatGPT · "best CRM for startups" · 2 min ago     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Design notes:**
- Large circular gauge (like a credit score) with color: 0-30 red, 30-60 amber, 60-100 green.
- Verdict text below in regular weight — this is the most valuable line on the page.
- Small metadata line: platform icon, query text, timestamp.
- This should be the FIRST thing the user sees. Everything else is supporting evidence.

---

### 2. Four Key Metric Cards (2×2 Grid)

```
┌──────────────────────┐  ┌──────────────────────┐
│  📍 RANK             │  │  📊 SHARE OF VOICE   │
│                      │  │                       │
│  #2 of 6             │  │  28%                  │
│  "best for startups" │  │  ████████░░░░░░░░     │
│                      │  │  prominence: signif.  │
└──────────────────────┘  └───────────────────────┘
┌──────────────────────┐  ┌──────────────────────┐
│  💬 SENTIMENT        │  │  ⭐ RECOMMENDATION    │
│                      │  │                       │
│  +0.65 Positive      │  │  Strong Alternative   │
│  ██████████████░░░░  │  │  Best for: startups,  │
│                      │  │  small teams          │
└──────────────────────┘  └───────────────────────┘
```

**Design notes:**
- Each card has ONE headline number/label + one line of context.
- Rank: show as "#N of M" with ranking context below.
- Share of Voice: horizontal bar showing the brand's % vs remaining.
- Sentiment: gradient bar from red (-1) to green (+1) with marker.
- Recommendation: badge/pill showing the type + "best for" tags.

---

### 3. Competitive Landscape — Horizontal Bar Chart

```
┌─────────────────────────────────────────────────────┐
│  COMPETITIVE LANDSCAPE                              │
│                                                     │
│  Your Brand  ████████████████████████████  #2  +0.6 │
│  Salesforce  ██████████████████████████████████  #1  +0.7 │
│  Zoho        ████████████████              #3  +0.3 │
│  Pipedrive   █████████████                 #4  +0.2 │
│  Freshsales  ████████                      #5  -0.1 │
│                                                     │
│  ▸ Click any competitor for head-to-head breakdown  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Design notes:**
- Horizontal bars sorted by rank position.
- Bar length = share of voice or sentiment. Color = sentiment (green/red gradient).
- Your brand's row is highlighted/accented.
- Expandable: clicking a competitor shows `winsOver` / `losesTo` as a two-column comparison.

**Expanded competitor detail:**
```
┌───────────────────────────────────────────────┐
│  YOUR BRAND vs SALESFORCE                     │
│                                               │
│  You win on:          They win on:            │
│  ✅ Ease of use       ❌ Enterprise features  │
│  ✅ Pricing           ❌ Ecosystem size       │
│  ✅ Onboarding speed  ❌ Customizability      │
└───────────────────────────────────────────────┘
```

---

### 4. Sentiment Breakdown — Two Columns

```
┌─────────────────────────────────────────────────────┐
│  WHAT AI IS SAYING ABOUT YOU                        │
│                                                     │
│  ✅ Positives              ⚠️ Negatives             │
│  ─────────                 ─────────                │
│  Intuitive interface       Steep learning curve     │
│  Strong API ecosystem      Limited reporting        │
│  Great for small teams     Expensive at scale       │
│  Fast onboarding                                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Design notes:**
- Simple two-column layout. Green checkmarks / amber warnings.
- These come directly from `sentiment.positives` and `sentiment.negatives`.
- Scannable in under 3 seconds — this is what brand managers care about most after the score.

---

### 5. Brand Perception Card

```
┌─────────────────────────────────────────────────────┐
│  AI PERCEPTION                                      │
│                                                     │
│  Best known for: "affordable CRM for startups"      │
│  Pricing perception: Mid-range                      │
│                                                     │
│  Core claims:                                       │
│  • "Easy-to-use CRM with strong automation"         │
│  • "Good free tier for small teams"                 │
│  • "Growing app marketplace"                        │
│                                                     │
│  Differentiators:                                   │
│  ┌──────────────────┐ ┌──────────────┐ ┌─────────┐ │
│  │ Free tier        │ │ AI assistant │ │ UX      │ │
│  └──────────────────┘ └──────────────┘ └─────────┘ │
└─────────────────────────────────────────────────────┘
```

**Design notes:**
- `bestKnownFor` as a highlighted quote/callout at the top.
- Pricing perception as a simple badge.
- Core claims as short bullet points (these come from `perception.coreClaims`).
- Differentiators as pill/tag components.

---

### 6. Risk Alerts — Dismissable Banner or Card

```
┌─────────────────────────────────────────────────────┐
│  🔴 CRITICAL: Factual error detected                │
│  "Response states your product launched in 2020,    │
│   but actual launch was 2018"                       │
├─────────────────────────────────────────────────────┤
│  🟡 WARNING: Outdated information                   │
│  "Mentions your old pricing tier that was           │
│   discontinued in 2024"                             │
└─────────────────────────────────────────────────────┘
```

**Design notes:**
- Only show this section if `risks.hasRisks === true`.
- Color-coded by severity: red = critical, amber = warning, blue = info.
- Each risk is a single line with expandable detail.
- This section drives urgency — brands can take immediate action on factual errors.

---

### 7. Action Items — Bottom of Page

```
┌─────────────────────────────────────────────────────┐
│  RECOMMENDED ACTIONS                                │
│                                                     │
│  🔴 CRITICAL                                        │
│  Update your FAQ and docs to correct the 2020       │
│  launch date — LLMs are picking up wrong info       │
│                                                     │
│  🟠 HIGH                                            │
│  Publish comparison content vs Salesforce            │
│  highlighting your pricing advantage                │
│                                                     │
│  🟡 MEDIUM                                          │
│  Create content targeting "best CRM for startups"   │
│  queries — you're close to #1 position              │
│                                                     │
│  🔵 LOW                                             │
│  Add case studies for enterprise use cases to        │
│  counter "only for small teams" perception          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Design notes:**
- Ordered by priority. Color-coded dots.
- Each action is specific and actionable (the prompt enforces this).
- This is the "so what now?" section — probably the highest-value part after the score.

---

## Aggregated Dashboard View (Across Multiple Queries)

When you have data from multiple queries across multiple platforms, the most powerful
views become:

### Trend Lines (over time)
- **GEO Score over time** — line chart per platform (ChatGPT vs Claude vs Perplexity)
- **Rank position over time** — are you moving up or down?
- **Sentiment over time** — is the narrative improving?

### Aggregate Metrics
- **Average GEO Score** across all tracked queries
- **% of queries where brand is mentioned** (presence rate)
- **% of queries where brand is #1** (win rate)
- **% of queries where brand is recommended** (recommendation rate)
- **Most common competitor** appearing alongside your brand
- **Top 5 recurring positives/negatives** across all responses

### Query-Level Table
A sortable table where each row is one tracked query:

| Query                        | Platform   | Score | Rank | Sentiment | Rec Type          |
|------------------------------|------------|-------|------|-----------|-------------------|
| "best CRM for startups"     | ChatGPT    | 73    | #2   | +0.65     | Strong Alt        |
| "CRM comparison 2025"       | Claude     | 81    | #1   | +0.71     | Top Pick          |
| "affordable CRM tools"      | Perplexity | 45    | #4   | +0.20     | Mentioned Only    |

Clicking a row opens the full single-response dashboard above.

---