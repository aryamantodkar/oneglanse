function downloadBlob(
	filename: string,
	mimeType: string,
	content: string,
): void {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

export interface ReportMetric {
	label: string;
	value: string | number;
	suffix?: string;
	highlight?: boolean;
}

export interface ReportInsight {
	label: string;
	value: string;
	sub?: string;
}

export interface ReportAction {
	text: string;
}

export interface ReportSection {
	title: string;
	rows: ReportInsight[];
}

export interface ReportRecord {
	promptId: string;
	prompt: string;
	model: string;
	runAt: string;
	geoScore: number | string;
	sentiment: number | string;
	visibility: number | string;
	rank: number | string;
	recommendation: string;
	mentioned: boolean | string;
	riskCritical: number;
	riskWarning: number;
	riskInfo: number;
	citationCount: number;
	bestKnownFor: string;
	pricingPerception: string;
	coreClaims: string;
	differentiators: string;
	competitorNames: string;
	sourceUrls: string;
	sourceDomains: string;
	response: string;
}

export interface ReportData {
	title: string;
	subtitle: string;
	generatedAt: string;
	metrics: ReportMetric[];
	actions: ReportAction[];
	sections: ReportSection[];
	records?: ReportRecord[];
}

export function downloadHtmlReport(filename: string, data: ReportData): void {
	const html = buildHtml(data);
	downloadBlob(filename, "text/html;charset=utf-8", html);
}

function escapeHtml(s: string | number | boolean | null | undefined): string {
	if (s === null || s === undefined) return "";
	return String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function buildHtml(data: ReportData): string {
	const metricCards = data.metrics
		.map(
			(m) => `
    <div class="metric-card${m.highlight ? " highlight" : ""}">
      <div class="metric-value">${escapeHtml(m.value)}${m.suffix ? `<span class="metric-suffix">${escapeHtml(m.suffix)}</span>` : ""}</div>
      <div class="metric-label">${escapeHtml(m.label)}</div>
    </div>`,
		)
		.join("");

	const actionItems = data.actions
		.map(
			(a, i) => `
    <li class="action-item">
      <span class="action-num">${i + 1}</span>
      <span>${escapeHtml(a.text)}</span>
    </li>`,
		)
		.join("");

	const sections = data.sections
		.map((sec) => {
			const rows = sec.rows
				.map(
					(row) => `
        <tr>
          <td class="row-label">${escapeHtml(row.label)}</td>
          <td class="row-value">${escapeHtml(row.value)}${row.sub ? `<span class="row-sub"> ${escapeHtml(row.sub)}</span>` : ""}</td>
        </tr>`,
				)
				.join("");
			return `
      <div class="section">
        <h3 class="section-title">${escapeHtml(sec.title)}</h3>
        <table class="data-table">
          <tbody>${rows}</tbody>
        </table>
      </div>`;
		})
		.join("");

	const recordsTable =
		data.records && data.records.length > 0
			? buildRecordsTable(data.records)
			: "";

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(data.title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    background: #f8f9fa;
    color: #1a1a2e;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    max-width: 1100px;
    margin: 0 auto;
    padding: 48px 32px 64px;
  }
  .header {
    margin-bottom: 40px;
    padding-bottom: 24px;
    border-bottom: 2px solid #e8eaed;
  }
  .header-eyebrow {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #6c757d;
    margin-bottom: 6px;
  }
  .header-title {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.04em;
    color: #0d0d1a;
    margin-bottom: 4px;
  }
  .header-subtitle { font-size: 14px; color: #6c757d; }
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 14px;
    margin-bottom: 40px;
  }
  .metric-card {
    background: #fff;
    border: 1px solid #e8eaed;
    border-radius: 10px;
    padding: 18px 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .metric-card.highlight {
    background: #0d0d1a;
    border-color: #0d0d1a;
    color: #fff;
  }
  .metric-card.highlight .metric-label { color: rgba(255,255,255,0.6); }
  .metric-value {
    font-size: 30px;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1;
    margin-bottom: 6px;
  }
  .metric-suffix { font-size: 16px; font-weight: 500; letter-spacing: 0; margin-left: 2px; }
  .metric-label { font-size: 12px; font-weight: 500; color: #6c757d; }
  .block-title {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6c757d;
    margin-bottom: 12px;
  }
  .actions-block {
    background: #fff;
    border: 1px solid #e8eaed;
    border-radius: 10px;
    padding: 22px 24px;
    margin-bottom: 40px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .actions-list { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .action-item { display: flex; align-items: flex-start; gap: 12px; font-size: 14px; color: #1a1a2e; line-height: 1.5; }
  .action-num {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 22px; height: 22px; border-radius: 50%;
    background: #0d0d1a; color: #fff; font-size: 11px; font-weight: 700;
    margin-top: 1px; flex-shrink: 0;
  }
  .sections-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 16px;
    margin-bottom: 40px;
  }
  .section {
    background: #fff; border: 1px solid #e8eaed; border-radius: 10px;
    padding: 20px 22px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .section-title {
    font-size: 13px; font-weight: 600; letter-spacing: 0.06em;
    text-transform: uppercase; color: #6c757d; margin-bottom: 14px;
  }
  .data-table { width: 100%; border-collapse: collapse; }
  .data-table tr + tr td { border-top: 1px solid #f0f1f3; }
  .data-table td { padding: 8px 0; font-size: 13px; vertical-align: top; }
  .row-label { color: #6c757d; width: 55%; padding-right: 12px; }
  .row-value { font-weight: 600; color: #0d0d1a; }
  .row-sub { font-weight: 400; color: #9ca3af; font-size: 12px; }

  /* Records table */
  .records-section {
    margin-top: 48px;
    padding-top: 32px;
    border-top: 2px solid #e8eaed;
  }
  .records-section-title {
    font-size: 18px; font-weight: 700; letter-spacing: -0.02em;
    color: #0d0d1a; margin-bottom: 6px;
  }
  .records-section-sub {
    font-size: 13px; color: #6c757d; margin-bottom: 24px;
  }
  .records-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .records-table {
    width: 100%; border-collapse: collapse; font-size: 12px;
    min-width: 1200px;
  }
  .records-table th {
    text-align: left; padding: 10px 12px;
    background: #f1f3f5; color: #495057;
    font-weight: 600; font-size: 11px;
    letter-spacing: 0.04em; text-transform: uppercase;
    white-space: nowrap;
    border-bottom: 2px solid #dee2e6;
  }
  .records-table td {
    padding: 10px 12px; vertical-align: top;
    border-bottom: 1px solid #f0f1f3; color: #1a1a2e;
  }
  .records-table tr:hover td { background: #f8f9fa; }
  .records-table td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .records-table td.prompt-cell { max-width: 260px; }
  .records-table td.response-cell { max-width: 340px; }
  .pill {
    display: inline-block; padding: 2px 7px; border-radius: 20px;
    font-size: 11px; font-weight: 600; white-space: nowrap;
  }
  .pill-green { background: #d3f9d8; color: #1a7f2e; }
  .pill-yellow { background: #fff3cd; color: #7d5a00; }
  .pill-red { background: #ffe0e0; color: #a01010; }
  .pill-gray { background: #f1f3f5; color: #6c757d; }
  .score-high { color: #1a7f2e; font-weight: 700; }
  .score-mid { color: #7d5a00; font-weight: 700; }
  .score-low { color: #a01010; font-weight: 700; }
  .risk-badge { font-size: 11px; }
  .risk-critical { color: #a01010; font-weight: 700; }
  .risk-warning { color: #7d5a00; }
  .response-text {
    display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
    overflow: hidden; color: #495057; line-height: 1.5;
  }
  details summary { cursor: pointer; color: #4a90d9; font-size: 11px; margin-top: 4px; }
  details[open] .response-text { display: block; -webkit-line-clamp: unset; }
  .mono { font-family: ui-monospace, monospace; font-size: 11px; color: #495057; }
  .footer {
    margin-top: 48px; padding-top: 20px; border-top: 1px solid #e8eaed;
    font-size: 11px; color: #adb5bd;
    display: flex; justify-content: space-between; align-items: center;
  }
  @media print {
    body { background: #fff; }
    .page { padding: 24px; }
    .metric-card, .actions-block, .section { box-shadow: none; }
    .records-scroll { overflow: visible; }
    .records-table { min-width: unset; font-size: 10px; }
    .records-table th, .records-table td { padding: 6px 8px; }
  }
</style>
</head>
<body>
<div class="page">
  <header class="header">
    <div class="header-eyebrow">AI Visibility Report</div>
    <h1 class="header-title">${escapeHtml(data.title)}</h1>
    <p class="header-subtitle">${escapeHtml(data.subtitle)}</p>
  </header>

  <div class="metrics-grid">
    ${metricCards}
  </div>

  ${
		data.actions.length > 0
			? `<div class="actions-block">
    <p class="block-title">Recommended Actions</p>
    <ol class="actions-list">
      ${actionItems}
    </ol>
  </div>`
			: ""
	}

  <div class="sections-grid">
    ${sections}
  </div>

  ${recordsTable}

  <footer class="footer">
    <span>Generated by Oneglanse</span>
    <span>${escapeHtml(data.generatedAt)}</span>
  </footer>
</div>
</body>
</html>`;
}

function scoreClass(v: number | string): string {
	const n = Number(v);
	if (Number.isNaN(n)) return "";
	if (n >= 70) return "score-high";
	if (n >= 40) return "score-mid";
	return "score-low";
}

function recPill(rec: string): string {
	const map: Record<string, string> = {
		top_pick: "pill-green",
		strong_alternative: "pill-green",
		conditional: "pill-yellow",
		mentioned_only: "pill-gray",
		discouraged: "pill-red",
		not_mentioned: "pill-red",
	};
	const cls = map[rec] ?? "pill-gray";
	const label = rec.replace(/_/g, " ");
	return `<span class="pill ${cls}">${escapeHtml(label)}</span>`;
}

function buildRecordsTable(records: ReportRecord[]): string {
	const rows = records
		.map((r) => {
			const geo = r.geoScore !== "" ? Number(r.geoScore) : null;
			const sent = r.sentiment !== "" ? Number(r.sentiment) : null;
			const vis = r.visibility !== "" ? Number(r.visibility) : null;
			const riskStr =
				r.riskCritical > 0
					? `<span class="risk-critical">C:${r.riskCritical}</span>${r.riskWarning > 0 ? ` <span class="risk-warning">W:${r.riskWarning}</span>` : ""}`
					: r.riskWarning > 0
						? `<span class="risk-warning">W:${r.riskWarning}</span>`
						: `<span style="color:#adb5bd">—</span>`;

			const responseHtml = r.response
				? `<details><summary>Show response</summary><div class="response-text">${escapeHtml(r.response)}</div></details>`
				: `<span style="color:#adb5bd">—</span>`;

			return `<tr>
      <td class="prompt-cell">${escapeHtml(r.prompt)}</td>
      <td class="mono">${escapeHtml(r.model)}</td>
      <td class="num ${geo !== null ? scoreClass(geo) : ""}">${geo !== null ? geo : "—"}</td>
      <td class="num ${sent !== null ? scoreClass(sent) : ""}">${sent !== null ? sent : "—"}</td>
      <td class="num ${vis !== null ? scoreClass(vis) : ""}">${vis !== null ? `${vis}%` : "—"}</td>
      <td class="num">${r.rank !== "" && r.rank !== null ? `#${r.rank}` : "—"}</td>
      <td>${recPill(String(r.recommendation))}</td>
      <td>${r.mentioned === true || r.mentioned === "true" ? "✓" : r.mentioned === false || r.mentioned === "false" ? "✗" : "—"}</td>
      <td class="risk-badge">${riskStr}</td>
      <td class="num">${r.citationCount}</td>
      <td>${escapeHtml(r.bestKnownFor) || "<span style='color:#adb5bd'>—</span>"}</td>
      <td>${escapeHtml(r.pricingPerception) || "<span style='color:#adb5bd'>—</span>"}</td>
      <td>${escapeHtml(r.coreClaims) || "<span style='color:#adb5bd'>—</span>"}</td>
      <td>${escapeHtml(r.competitorNames) || "<span style='color:#adb5bd'>—</span>"}</td>
      <td>${escapeHtml(r.sourceUrls) || "<span style='color:#adb5bd'>—</span>"}</td>
      <td class="response-cell">${responseHtml}</td>
    </tr>`;
		})
		.join("");

	return `
  <div class="records-section">
    <h2 class="records-section-title">All Analysis Records</h2>
    <p class="records-section-sub">${records.length} record${records.length === 1 ? "" : "s"} — every metric per prompt run. Expand each row to read the full model response.</p>
    <div class="records-scroll">
      <table class="records-table">
        <thead>
          <tr>
            <th>Prompt</th>
            <th>Model</th>
            <th>GEO</th>
            <th>Sentiment</th>
            <th>Visibility</th>
            <th>Rank</th>
            <th>Recommendation</th>
            <th>Mentioned</th>
            <th>Risks</th>
            <th>Citations</th>
            <th>Best Known For</th>
            <th>Pricing</th>
            <th>Core Claims</th>
            <th>Competitors</th>
            <th>Source URLs</th>
            <th>Response</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}
