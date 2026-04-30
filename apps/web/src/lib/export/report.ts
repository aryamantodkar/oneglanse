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

export interface ReportData {
	title: string;
	subtitle: string;
	generatedAt: string;
	metrics: ReportMetric[];
	actions: ReportAction[];
	sections: ReportSection[];
}

export function downloadHtmlReport(filename: string, data: ReportData): void {
	const html = buildHtml(data);
	downloadBlob(filename, "text/html;charset=utf-8", html);
}

function escapeHtml(s: string | number | null | undefined): string {
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
    max-width: 900px;
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
  .header-subtitle {
    font-size: 14px;
    color: #6c757d;
  }
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
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
  .metric-suffix {
    font-size: 16px;
    font-weight: 500;
    letter-spacing: 0;
    margin-left: 2px;
  }
  .metric-label {
    font-size: 12px;
    font-weight: 500;
    color: #6c757d;
  }
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
  .actions-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .action-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-size: 14px;
    color: #1a1a2e;
    line-height: 1.5;
  }
  .action-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #0d0d1a;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    margin-top: 1px;
    flex-shrink: 0;
  }
  .sections-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 16px;
  }
  .section {
    background: #fff;
    border: 1px solid #e8eaed;
    border-radius: 10px;
    padding: 20px 22px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .section-title {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #6c757d;
    margin-bottom: 14px;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
  }
  .data-table tr + tr td { border-top: 1px solid #f0f1f3; }
  .data-table td {
    padding: 8px 0;
    font-size: 13px;
    vertical-align: top;
  }
  .row-label {
    color: #6c757d;
    width: 55%;
    padding-right: 12px;
  }
  .row-value {
    font-weight: 600;
    color: #0d0d1a;
  }
  .row-sub {
    font-weight: 400;
    color: #9ca3af;
    font-size: 12px;
  }
  .footer {
    margin-top: 48px;
    padding-top: 20px;
    border-top: 1px solid #e8eaed;
    font-size: 11px;
    color: #adb5bd;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  @media print {
    body { background: #fff; }
    .page { padding: 24px; }
    .metric-card, .actions-block, .section { box-shadow: none; }
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

  <footer class="footer">
    <span>Generated by Oneglanse</span>
    <span>${escapeHtml(data.generatedAt)}</span>
  </footer>
</div>
</body>
</html>`;
}
