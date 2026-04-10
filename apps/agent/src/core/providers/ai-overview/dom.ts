import type { Page } from "playwright";

type OverviewSignal = {
	found: boolean;
	score: number;
	textLength: number;
	sourceControlCount: number;
	showMoreCount: number;
	selector?: string;
};

type OverviewAnalysis = OverviewSignal & {
	html: string;
	text: string;
	markersFound: boolean;
};

type DomMetrics = {
	selector: string;
	tag: string;
	top: number;
	left: number;
	width: number;
	height: number;
	textLength: number;
	text: string;
	anchorCount: number;
	buttonCount: number;
	blockCount: number;
	tableCount: number;
	listCount: number;
	sourceControlCount: number;
	showMoreCount: number;
	summaryBlockCount: number;
};

function cleanExtractedText(value: string): string {
	return value.replace(/\n{3,}/g, "\n\n").trim();
}

async function analyzeAiOverview(page: Page): Promise<OverviewAnalysis> {
	return await page.evaluate(() => {
		type AnalysisResult = OverviewAnalysis;
		type Metrics = DomMetrics;

		function isVisible(element: Element | null): element is HTMLElement {
			if (!(element instanceof HTMLElement)) return false;
			if (!element.isConnected) return false;
			const style = window.getComputedStyle(element);
			if (
				style.display === "none" ||
				style.visibility === "hidden" ||
				style.opacity === "0" ||
				element.hidden ||
				element.getAttribute("aria-hidden") === "true"
			) {
				return false;
			}
			const rect = element.getBoundingClientRect();
			return rect.width >= 8 && rect.height >= 8;
		}

		function textOf(element: Element | null): string {
			return (
				(element instanceof HTMLElement
					? element.innerText
					: element?.textContent) || ""
			)
				.replace(/\r/g, "")
				.replace(/\u200b/g, "")
				.replace(/[ \t]+\n/g, "\n")
				.replace(/\n{3,}/g, "\n\n")
				.replace(/[ \t]{2,}/g, " ")
				.trim();
		}

		function labelOf(element: Element | null): string {
			if (!(element instanceof Element)) return "";
			return [
				element.getAttribute("aria-label") || "",
				element.getAttribute("title") || "",
				element.getAttribute("role") || "",
				textOf(element),
			]
				.join(" ")
				.toLowerCase();
		}

		function escapeCss(value: string): string {
			if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
				return CSS.escape(value);
			}
			return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
		}

		function buildSelector(element: Element): string {
			const parts: string[] = [];
			let current: Element | null = element;
			while (current && parts.length < 8) {
				let part = current.tagName.toLowerCase();
				if (current.id) {
					part += `#${escapeCss(current.id)}`;
					parts.unshift(part);
					break;
				}

				for (const [name, value] of [
					["data-subtree", current.getAttribute("data-subtree")],
					["aria-label", current.getAttribute("aria-label")],
					["role", current.getAttribute("role")],
				] as Array<[string, string | null]>) {
					if (value && value.length <= 80) {
						part += `[${name}="${escapeCss(value)}"]`;
						break;
					}
				}

				const classTokens = Array.from(current.classList).filter(
					(token) => /^[a-z][a-z0-9_-]{2,}$/i.test(token),
				);
					const firstClassToken = classTokens[0];
					if (firstClassToken) {
						part += `.${escapeCss(firstClassToken)}`;
				}

				const parent = current.parentElement;
				if (parent) {
					const siblings = Array.from(parent.children).filter(
						(child) => child.tagName === current?.tagName,
					);
					if (siblings.length > 1) {
						const index = siblings.indexOf(current) + 1;
						part += `:nth-of-type(${index})`;
					}
				}

				parts.unshift(part);
				current = current.parentElement;
			}

			return parts.join(" > ");
		}

		function isSourceControl(element: Element | null): boolean {
			if (!(element instanceof Element) || !isVisible(element)) return false;
			const label = labelOf(element);
			return (
				label.includes("view related links") ||
				label.includes("show all related links")
			);
		}

		function isExpansionControl(element: Element | null): boolean {
			if (!(element instanceof Element) || !isVisible(element)) return false;
			const label = labelOf(element);
			if (
				label.includes("related links") ||
				label.includes("about this result") ||
				label.includes("more filters") ||
				label.includes("share")
			) {
				return false;
			}
			return /\b(show more|more|expand)\b/.test(label);
		}

			function visibleDescendants(root: ParentNode, selector: string): HTMLElement[] {
				try {
					return Array.from(root.querySelectorAll(selector)).filter(
						isVisible,
					) as HTMLElement[];
				} catch {
					return [];
				}
		}

		function hasEditableDescendant(element: Element): boolean {
			return Boolean(
				element.querySelector(
					'textarea, input:not([type="hidden"]), [contenteditable="true"], [role="textbox"]',
				),
			);
		}

		function summaryBlockCount(element: HTMLElement): number {
				const blocks = visibleDescendants(element, "div,p,li,section,article,aside");
			let count = 0;
			for (const block of blocks) {
				if (block === element) continue;
				const textLength = textOf(block).length;
				if (textLength < 80 || textLength > 900) continue;
				const linkCount = visibleDescendants(block, "a[href]").length;
				const sourceControls = visibleDescendants(
					block,
					'button,[role="button"],[aria-label],[title]',
				).filter(isSourceControl).length;
				const interactiveCount = visibleDescendants(
					block,
					'button,[role="button"]',
				).length;
				if (linkCount > 1 || sourceControls > 1 || interactiveCount > 1) continue;
				count += 1;
			}
			return Math.min(count, 12);
		}

		function measure(element: HTMLElement): Metrics | null {
			if (!isVisible(element) || hasEditableDescendant(element)) return null;
			const rect = element.getBoundingClientRect();
			const text = textOf(element);
			const textLength = text.length;
			if (textLength < 160 || textLength > 12000) return null;
			if (rect.top < -60 || rect.top > 2600) return null;
			if (rect.height < 90 || rect.width < 220) return null;

			const sourceControls = visibleDescendants(
				element,
				'button,[role="button"],[aria-label],[title]',
			).filter(isSourceControl);
			const showMoreControls = visibleDescendants(
				element,
				'button,[role="button"],[aria-label],[title]',
			).filter(isExpansionControl);

			return {
				selector: buildSelector(element),
				tag: element.tagName.toLowerCase(),
				top: Math.round(rect.top),
				left: Math.round(rect.left),
				width: Math.round(rect.width),
				height: Math.round(rect.height),
				textLength,
				text: text.slice(0, 600),
				anchorCount: visibleDescendants(element, "a[href]").length,
				buttonCount: visibleDescendants(element, 'button,[role="button"]').length,
				blockCount: visibleDescendants(
					element,
					"p,li,pre,table,blockquote,h1,h2,h3,h4,h5,h6,ul,ol",
				).length,
				tableCount: visibleDescendants(element, "table").length,
				listCount: visibleDescendants(element, "ul,ol").length,
				sourceControlCount: sourceControls.length,
				showMoreCount: showMoreControls.length,
				summaryBlockCount: summaryBlockCount(element),
			};
		}

		const visibleControls = visibleDescendants(
			document,
			'button,[role="button"],[aria-label],[title]',
		);
		const visibleTopTextMarkers = Array.from(document.querySelectorAll("body *"))
			.filter(isVisible)
			.some((element) => {
				const rect = element.getBoundingClientRect();
				if (rect.top < -20 || rect.top > 1200) return false;
				const text = textOf(element).toLowerCase();
				return (
					text === "ai overview" ||
					text.startsWith("ai overview ") ||
					text.includes("show more ai overview")
				);
			});
		const markersFound =
			visibleTopTextMarkers ||
			visibleControls.some((element) => {
				const label = labelOf(element);
				return (
					label.includes("view related links") ||
					label.includes("show all related links")
				);
			});

		const candidates = Array.from(document.querySelectorAll("body *"))
			.filter(isVisible)
			.map((element) => measure(element))
			.filter((value): value is Metrics => Boolean(value));

		let bestRoot: Metrics | null = null;
		let bestScore = Number.NEGATIVE_INFINITY;
		for (const candidate of candidates) {
			const topBonus = Math.max(0, 1600 - Math.abs(candidate.top - 320) * 2);
			let score =
				candidate.sourceControlCount * 2200 +
				candidate.showMoreCount * 1100 +
				Math.min(candidate.textLength, 5000) * 0.45 +
				Math.min(candidate.blockCount, 50) * 140 +
				Math.min(candidate.summaryBlockCount, 10) * 320 +
				candidate.tableCount * 900 +
				Math.min(candidate.listCount, 8) * 180 +
				topBonus;

			score -= candidate.anchorCount * 65;
			score -= candidate.buttonCount * 35;

			if (candidate.width > window.innerWidth * 0.92) {
				score -= 2200;
			}
			if (candidate.textLength > 7000) {
				score -= (candidate.textLength - 7000) * 1.6;
			}
			if (candidate.height > 3200) {
				score -= (candidate.height - 3200) * 2;
			}
			if (candidate.sourceControlCount === 0 && !markersFound) {
				score -= 2500;
			}

			if (!bestRoot || score > bestScore) {
				bestRoot = candidate;
				bestScore = score;
			}
		}

		if (!bestRoot) {
			return {
				found: false,
				score: 0,
				textLength: 0,
				sourceControlCount: 0,
				showMoreCount: 0,
				html: "",
				text: "",
				markersFound,
			} satisfies AnalysisResult;
		}

		const rootTextLower = bestRoot.text.toLowerCase();
		const rootLooksLikeOverview =
			bestRoot.sourceControlCount > 0 ||
			bestRoot.showMoreCount > 0 ||
			rootTextLower.includes("ai overview");

		if (!rootLooksLikeOverview) {
			return {
				found: false,
				score: bestScore,
				textLength: 0,
				sourceControlCount: 0,
				showMoreCount: 0,
				selector: bestRoot.selector,
				html: "",
				text: "",
				markersFound,
			} satisfies AnalysisResult;
		}

		const rootMatches = Array.from(
			document.querySelectorAll(bestRoot.selector),
		).filter(isVisible) as HTMLElement[];
		const root =
			rootMatches
				.map((element) => {
					const rect = element.getBoundingClientRect();
					const textLength = textOf(element).length;
					const distance =
						Math.abs(textLength - bestRoot.textLength) +
						Math.abs(Math.round(rect.top) - bestRoot.top) * 4 +
						Math.abs(Math.round(rect.left) - bestRoot.left) * 2 +
						Math.abs(Math.round(rect.width) - bestRoot.width) +
						Math.abs(Math.round(rect.height) - bestRoot.height);
					return { element, distance };
				})
				.sort((a, b) => a.distance - b.distance)
				.at(0)?.element ?? null;

		if (!root) {
			return {
					found: false,
					score: bestScore,
					textLength: bestRoot.textLength,
				sourceControlCount: bestRoot.sourceControlCount,
				showMoreCount: bestRoot.showMoreCount,
				selector: bestRoot.selector,
				html: "",
				text: "",
				markersFound,
			} satisfies AnalysisResult;
		}

		const removableClusters = Array.from(root.querySelectorAll("*"))
			.filter(isVisible)
			.map((element) => {
				const metrics = measure(element as HTMLElement);
				return metrics ? { element: element as HTMLElement, metrics } : null;
			})
			.filter(
				(
					value,
				): value is {
					element: HTMLElement;
					metrics: Metrics;
				} => Boolean(value),
			)
			.filter(
				({ element, metrics }) =>
					element !== root &&
					metrics.sourceControlCount >= 2 &&
					metrics.textLength <= 2200 &&
					metrics.blockCount <= 10 &&
					metrics.tableCount === 0,
			)
			.sort(
				(a, b) =>
					a.metrics.width * a.metrics.height -
						b.metrics.width * b.metrics.height ||
					b.metrics.sourceControlCount - a.metrics.sourceControlCount,
			);

		const clusterElements: HTMLElement[] = [];
		for (const cluster of removableClusters) {
			if (
				clusterElements.some(
					(existing) =>
						existing.contains(cluster.element) || cluster.element.contains(existing),
				)
			) {
				continue;
			}
			clusterElements.push(cluster.element);
		}

		for (const cluster of clusterElements) {
			cluster.setAttribute("data-oneglanse-remove", "1");
		}

			function sanitizeContainer(container: HTMLElement): void {
			for (const selector of [
				"script",
				"style",
				"svg",
				"noscript",
				"iframe",
				'[role="dialog"]',
				'[aria-modal="true"]',
				"[hidden]",
				'[aria-hidden="true"]',
				'[style*="display:none"]',
				'[style*="display: none"]',
				'[role="progressbar"]',
				"button",
				"summary",
				"sup",
				'[aria-label*="related links" i]',
				'[title*="related links" i]',
				'[aria-label*="about this result" i]',
				'[title*="about this result" i]',
				'[aria-label*="show all related links" i]',
				'[title*="show all related links" i]',
				'[aria-label*="share" i]',
				'[title*="share" i]',
			]) {
				try {
					for (const element of Array.from(container.querySelectorAll(selector))) {
						element.remove();
					}
				} catch {}
			}

			for (const anchor of Array.from(
				container.querySelectorAll("a[href]"),
			) as HTMLAnchorElement[]) {
				const anchorText = textOf(anchor);
				const parentText = textOf(anchor.parentElement);
				if (!anchorText) {
					anchor.remove();
					continue;
				}
				const looksLikeStandaloneBadge =
					parentText === anchorText &&
					anchorText.length <= 48 &&
					(!/\s/.test(anchorText) || /\+\d+$/.test(anchorText));
				if (looksLikeStandaloneBadge) {
					anchor.remove();
				}
			}
		}

		const rootRect = root.getBoundingClientRect();
		const blockCandidates = Array.from(
			root.querySelectorAll(
				"div,p,li,table,section,article,h1,h2,h3,h4,h5,h6,ul,ol",
			),
		)
			.filter(isVisible)
			.map((element) => {
				const node = element as HTMLElement;
				const rect = node.getBoundingClientRect();
				const text = textOf(node);
				const textLength = text.length;
				const anchorCount = visibleDescendants(node, "a[href]").length;
				const sourceControlCount = visibleDescendants(
					node,
					'button,[role="button"],[aria-label],[title]',
				).filter(isSourceControl).length;
				const buttonCount = visibleDescendants(node, 'button,[role="button"]').length;
				return {
					element: node,
					top: rect.top,
					left: rect.left,
					width: rect.width,
					height: rect.height,
					text,
					textLength,
					anchorCount,
					sourceControlCount,
					buttonCount,
				};
			})
			.filter((candidate) => {
				if (candidate.textLength < 40 || candidate.textLength > 1400) return false;
				if (candidate.height < 18) return false;
				const isMainLeadBlock =
					candidate.top <= rootRect.top + 140 &&
					candidate.left < rootRect.left + rootRect.width * 0.55 &&
					candidate.width >= rootRect.width * 0.45 &&
					candidate.textLength >= 120;
				if (candidate.anchorCount > (isMainLeadBlock ? 2 : 1)) return false;
				if (candidate.sourceControlCount > (isMainLeadBlock ? 3 : 1)) return false;
				if (candidate.buttonCount > (isMainLeadBlock ? 3 : 1)) return false;
				if (
					candidate.element.closest('[role="dialog"],[aria-modal="true"]')
				) {
					return false;
				}
				if (
					rootRect.width > 700 &&
					candidate.left >= rootRect.left + rootRect.width * 0.55 &&
					candidate.width < rootRect.width * 0.55
				) {
					return false;
				}
				const textLower = candidate.text.toLowerCase();
				const textLead = candidate.text.slice(0, 140);
				if (
					textLower.includes("view related links") ||
					textLower.includes("show all related links") ||
					textLower.includes("about this result") ||
					/https?:\/\//i.test(textLead) ||
					textLead.includes(" › ") ||
					/\b[a-z0-9-]+\.(?:org|com|gov|edu|net|in)\b/i.test(textLead)
				) {
					return false;
				}
				return true;
			});

		const selectedBlocks = blockCandidates
			.filter(
				(candidate) =>
					!blockCandidates.some(
						(other) =>
							other !== candidate &&
							candidate.element.contains(other.element) &&
							other.textLength >= candidate.textLength * 0.55,
					),
			)
			.sort((a, b) => a.top - b.top || a.left - b.left);

		const assembled = document.createElement("div");
		for (const block of selectedBlocks) {
			assembled.appendChild(block.element.cloneNode(true));
		}
		sanitizeContainer(assembled);
		const assembledText = textOf(assembled);
		if (assembledText.length >= 180) {
			for (const cluster of clusterElements) {
				cluster.removeAttribute("data-oneglanse-remove");
			}
			return {
				found: rootLooksLikeOverview,
				score: bestScore,
				textLength: assembledText.length,
				sourceControlCount: bestRoot.sourceControlCount,
				showMoreCount: bestRoot.showMoreCount,
				selector: bestRoot.selector,
				html: assembled.innerHTML.trim(),
				text: assembledText,
				markersFound,
			} satisfies AnalysisResult;
		}

		const clone = root.cloneNode(true);
		if (!(clone instanceof HTMLElement)) {
			for (const cluster of clusterElements) {
				cluster.removeAttribute("data-oneglanse-remove");
			}
			return {
				found: rootLooksLikeOverview,
				score: bestScore,
				textLength: bestRoot.textLength,
				sourceControlCount: bestRoot.sourceControlCount,
				showMoreCount: bestRoot.showMoreCount,
				selector: bestRoot.selector,
				html: "",
				text: "",
				markersFound,
			} satisfies AnalysisResult;
		}

		for (const cluster of clusterElements) {
			cluster.removeAttribute("data-oneglanse-remove");
		}

		for (const element of Array.from(
			clone.querySelectorAll('[data-oneglanse-remove="1"]'),
		)) {
			element.remove();
		}
		sanitizeContainer(clone);

		const html = clone.innerHTML.trim();
		const text = textOf(clone);

		return {
				found: rootLooksLikeOverview,
				score: bestScore,
			textLength: text.length,
			sourceControlCount: bestRoot.sourceControlCount,
			showMoreCount: bestRoot.showMoreCount,
			selector: bestRoot.selector,
			html,
			text,
			markersFound,
		} satisfies AnalysisResult;
	}, null);
}

async function findOverviewExpansionControl(page: Page): Promise<string | null> {
	return await page
		.evaluate(() => {
			function isVisible(element: Element | null): element is HTMLElement {
				if (!(element instanceof HTMLElement)) return false;
				if (!element.isConnected) return false;
				const style = window.getComputedStyle(element);
				if (
					style.display === "none" ||
					style.visibility === "hidden" ||
					style.opacity === "0" ||
					element.hidden ||
					element.getAttribute("aria-hidden") === "true"
				) {
					return false;
				}
				const rect = element.getBoundingClientRect();
				return rect.width >= 8 && rect.height >= 8;
			}

			function labelOf(element: Element | null): string {
				if (!(element instanceof Element)) return "";
				return [
					element.getAttribute("aria-label") || "",
					element.getAttribute("title") || "",
					(element instanceof HTMLElement
						? element.innerText
						: element.textContent) || "",
				]
					.join(" ")
					.toLowerCase()
					.trim();
			}

			function escapeCss(value: string): string {
				if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
					return CSS.escape(value);
				}
				return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
			}

			function buildSelector(element: Element): string {
				const parts: string[] = [];
				let current: Element | null = element;
				while (current && parts.length < 8) {
					let part = current.tagName.toLowerCase();
					if (current.id) {
						part += `#${escapeCss(current.id)}`;
						parts.unshift(part);
						break;
					}
					const ariaLabel = current.getAttribute("aria-label");
					if (ariaLabel) {
						part += `[aria-label="${escapeCss(ariaLabel)}"]`;
					}
					parts.unshift(part);
					current = current.parentElement;
				}
				return parts.join(" > ");
			}

			function closestClickable(element: Element): Element {
				return (
					element.closest('button,[role="button"],a[href],[tabindex]') ?? element
				);
			}

			const controls = Array.from(
				document.querySelectorAll(
					'button,[role="button"],[aria-label],[title],a[href],div,span',
				),
			).filter(isVisible);
			const scoredControls: Array<{ selector: string; score: number }> = [];
			for (const control of controls) {
				const label = labelOf(control);
				if (
					!/\b(show more|expand|view more|read more|more)\b/.test(label) ||
					label.includes("related links") ||
					label.includes("about this result") ||
					label.includes("more filters") ||
					label.includes("share")
				) {
					continue;
				}
				const rect = control.getBoundingClientRect();
				if (rect.top < 120 || rect.top > 1600) continue;
				const clickable = closestClickable(control);
				const clickableLabel = labelOf(clickable);
				let score = 0;
				if (/\bshow more\b/.test(label) || /\bshow more\b/.test(clickableLabel)) {
					score += 5000;
				}
				if (/\bexpand\b/.test(label) || /\bexpand\b/.test(clickableLabel)) {
					score += 3000;
				}
				if (/\bmore\b/.test(label) || /\bmore\b/.test(clickableLabel)) {
					score += 500;
				}
				score += Math.max(0, 1800 - Math.abs(rect.top - 420) * 2);
				if (rect.left < window.innerWidth * 0.75) {
					score += 800;
				}
				scoredControls.push({
					selector: buildSelector(clickable),
					score,
				});
			}
			scoredControls.sort((a, b) => b.score - a.score);
			return scoredControls[0]?.selector ?? null;
		}, null)
		.catch(() => null);
}

export async function prepareAiOverviewViewport(page: Page): Promise<void> {
	await page
		.evaluate(() => {
			const root =
				document.scrollingElement ?? document.documentElement ?? document.body;
			root.scrollTo(0, 0);
		}, null)
		.catch(() => null);
	await page.waitForTimeout(150);

	for (let attempt = 0; attempt < 2; attempt += 1) {
		const maybeExpand = await findOverviewExpansionControl(page);
		if (!maybeExpand) {
			break;
		}
		const locator = page.locator(maybeExpand).first();
		const visible = await locator.isVisible().catch(() => false);
		if (!visible) {
			break;
		}
		await locator.click({ timeout: 2_000 }).catch(() => null);
		await page.waitForTimeout(600);
	}
}

export async function readAiOverviewSignals(page: Page): Promise<OverviewSignal> {
	const analysis = await analyzeAiOverview(page).catch(() => null);
	if (!analysis) {
		return {
			found: false,
			score: 0,
			textLength: 0,
			sourceControlCount: 0,
			showMoreCount: 0,
		};
	}

	return {
		found: analysis.found,
		score: analysis.score,
		textLength: analysis.textLength,
		sourceControlCount: analysis.sourceControlCount,
		showMoreCount: analysis.showMoreCount,
		selector: analysis.selector,
	};
}

export async function hasAiOverviewSemanticMarkers(page: Page): Promise<boolean> {
	const analysis = await analyzeAiOverview(page).catch(() => null);
	return analysis?.markersFound ?? false;
}

export async function extractAiOverviewFallbackHtml(page: Page): Promise<string> {
	const analysis = await analyzeAiOverview(page).catch(() => null);
	if (!analysis?.found) {
		return "";
	}
	return analysis.html.trim();
}

export async function extractAiOverviewFallbackText(page: Page): Promise<string> {
	const analysis = await analyzeAiOverview(page).catch(() => null);
	if (!analysis?.found) {
		return "";
	}
	return cleanExtractedText(analysis.text);
}
