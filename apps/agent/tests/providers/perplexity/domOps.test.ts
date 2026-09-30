import { PROVIDER_MODEL_RESPONSE_SELECTORS } from "@oneglanse/utils";
import { JSDOM } from "jsdom";
import type { Page as PlaywrightPage } from "playwright-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runPageDomOp } from "../../../src/lib/browser/domOps.js";

function createPage(html: string): PlaywrightPage {
	const dom = new JSDOM(html, {
		url: "https://www.perplexity.ai/search/example",
	});
	const { window } = dom;

	Object.defineProperty(window.HTMLElement.prototype, "innerText", {
		configurable: true,
		get() {
			return this.textContent ?? "";
		},
	});
	window.HTMLElement.prototype.getBoundingClientRect = () =>
		({ width: 100, height: 20 }) as DOMRect;

	vi.stubGlobal("document", window.document);
	vi.stubGlobal("window", window);
	vi.stubGlobal("HTMLElement", window.HTMLElement);
	vi.stubGlobal("HTMLAnchorElement", window.HTMLAnchorElement);
	vi.stubGlobal("Node", window.Node);
	vi.stubGlobal("navigator", window.navigator);

	return {
		evaluate: async (
			operation: (params: unknown) => unknown,
			params: unknown,
		) => operation(params),
	} as unknown as PlaywrightPage;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("Perplexity response extraction", () => {
	it("uses the bare .prose fallback for the latest answer", async () => {
		const page = createPage(`
			<div class="prose">${"Earlier answer. ".repeat(8)}</div>
			<div class="prose">${"Latest answer. ".repeat(8)}</div>
		`);

		const response = await runPageDomOp<string>(page, "response-html", {
			provider: "perplexity",
			selectors: PROVIDER_MODEL_RESPONSE_SELECTORS.perplexity,
		});

		expect(response).toContain("Latest answer.");
		expect(response).not.toContain("Earlier answer.");
	});
});

describe("Perplexity citation extraction", () => {
	it("falls back to the document when the citation panel is empty", async () => {
		const page = createPage(`
			<div role="tabpanel" aria-labelledby="citations-tab"></div>
			<a href="https://example.com/report#section">
				<span>example.com</span><span>Useful report</span>
			</a>
			<a href="https://example.com/report#other">
				<span>example.com</span><span>Duplicate report</span>
			</a>
			<a href="https://www.perplexity.ai/search/related">
				<span>perplexity.ai</span><span>Related search</span>
			</a>
		`);

		const sources = await runPageDomOp<Array<{ rawHref: string }>>(
			page,
			"raw-sources",
			{ provider: "perplexity" },
		);

		expect(sources.map((source) => source.rawHref)).toEqual([
			"https://example.com/report",
		]);
	});

	it("keeps the citation panel as the source of truth when it has links", async () => {
		const page = createPage(`
			<div role="tabpanel" aria-labelledby="citations-tab">
				<a href="https://panel.example/article">
					<span>panel.example</span><span>Panel article</span>
				</a>
			</div>
			<a href="https://outside.example/article">
				<span>outside.example</span><span>Outside article</span>
			</a>
		`);

		const sources = await runPageDomOp<Array<{ rawHref: string }>>(
			page,
			"raw-sources",
			{ provider: "perplexity" },
		);

		expect(sources.map((source) => source.rawHref)).toEqual([
			"https://panel.example/article",
		]);
	});
});
