import { MethodologyArticle } from "@/components/content/methodology-article";
import {
	WhyCamoufoxArticle,
	whyCamoufoxIntro,
	whyCamoufoxTitle,
} from "@/components/content/why-camoufox-article";
import {
	WhySelfHostedArticle,
	whySelfHostedIntro,
	whySelfHostedTitle,
} from "@/components/content/why-self-hosted-article";
import { comparisonTool, comparisons } from "@/content/comparisons";
import { guides } from "@/content/guides";
import { categories, tools, verifiedAt } from "@/content/tools";
import {
	PRODUCT_POSITIONING,
	PRODUCT_SUMMARY,
	SITE_URLS,
} from "@/lib/landing-content";
import { type FunctionComponent, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import TurndownService from "turndown";

const markdown = new TurndownService({
	headingStyle: "atx",
	bulletListMarker: "-",
});

function article(component: FunctionComponent): string {
	return markdown
		.turndown(renderToStaticMarkup(createElement(component)))
		.replace(/\]\((\/[^)]+)\)/g, `](${SITE_URLS.homepage}$1)`)
		.trim();
}

function section(title: string, path: string, body: string): string {
	return `# ${title}\n\nSource: ${SITE_URLS.homepage}${path}\n\n${body.trim()}`;
}

function guideSections(): string[] {
	return guides.map((guide) =>
		section(
			guide.title,
			`/guides/${guide.slug}`,
			[
				guide.intro,
				`## ${guide.example.heading}\n\n${guide.example.text}`,
				...guide.sections.map(
					(item) => `## ${item.heading}\n\n${item.paragraphs.join("\n\n")}`,
				),
				`## Sources\n\n${guide.sources.map((source) => `- [${source.label}](${source.url})`).join("\n")}`,
			].join("\n\n"),
		),
	);
}

function toolSections(): string[] {
	const directory = section(
		"AI visibility tools",
		"/ai-visibility-tools",
		[
			`Public product information checked ${verifiedAt}. I build OneGlanse, so this is not an independent benchmark. Check each source and current plan details.`,
			...tools.map(
				(tool) =>
					`## ${tool.name}\n\n${tool.summary}\n\n- Price / access: ${tool.model}\n- How it gets answers: ${tool.collection}\n- AI products: ${tool.targets}\n- Sources: ${tool.sources.map((source) => `[${source.label}](${source.url})`).join(", ")}`,
			),
		].join("\n\n"),
	);
	const categoryPages = Object.entries(categories).map(([slug, category]) =>
		section(
			category.title,
			`/ai-visibility-tools/${slug}`,
			`${category.description}\n\n${category.criteria.map((item) => `- ${item}`).join("\n")}\n\nIncluded: ${tools
				.filter(category.matches)
				.map((tool) => tool.name)
				.join(", ")}.`,
		),
	);
	return [directory, ...categoryPages];
}

function comparisonSections(): string[] {
	return comparisons.flatMap((comparison) => {
		const other = comparisonTool(comparison);
		if (!other) return [];
		return [
			section(
				`OneGlanse vs ${other.name}`,
				`/compare/${comparison.slug}`,
				[
					comparison.summary,
					`## What ${other.name} does well\n\n${comparison.otherStrength}`,
					`## How they get their answers\n\n${comparison.methodNote}`,
					`## OneGlanse makes more sense if\n\n${comparison.oneglanseFit}`,
					`## ${other.name} makes more sense if\n\n${comparison.otherFit}`,
					`## Sources\n\n${other.sources.map((source) => `- [${source.label}](${source.url})`).join("\n")}`,
				].join("\n\n"),
			),
		];
	});
}

export function fullText(): string {
	const pages = [
		`# OneGlanse\n\nSource: ${SITE_URLS.homepage}\n\n## ${PRODUCT_POSITIONING}\n\n${PRODUCT_SUMMARY}`,
		section(
			"How OneGlanse collects and analyzes AI answers",
			"/methodology",
			article(MethodologyArticle).replace(/^# .+\n\n/, ""),
		),
		section(
			whySelfHostedTitle,
			"/why-self-hosted",
			`${whySelfHostedIntro}\n\n${article(WhySelfHostedArticle)}`,
		),
		section(
			whyCamoufoxTitle,
			"/why-camoufox",
			`${whyCamoufoxIntro}\n\n${article(WhyCamoufoxArticle)}`,
		),
		...guideSections(),
		...toolSections(),
		...comparisonSections(),
	];
	return `${pages.join("\n\n---\n\n")}\n`;
}
