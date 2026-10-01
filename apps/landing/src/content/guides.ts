import type { Source } from "./sources";

export type Guide = {
	slug: string;
	title: string;
	intro: string;
	description: string;
	example: { heading: string; text: string };
	sections: { heading: string; paragraphs: string[] }[];
	sources: Source[];
};

const google = {
	label: "Google Search Central: AI features and your website",
	url: "https://developers.google.com/search/docs/appearance/ai-features",
};
const paper = {
	label: "GEO: Generative Engine Optimization (research paper)",
	url: "https://arxiv.org/abs/2311.09735",
};

export const guides: Guide[] = [
	{
		slug: "ai-visibility",
		title: "What is AI visibility?",
		description:
			"Measure brand mentions and citations in sampled AI answers. Build a prompt set, report failures, and interpret results.",
		intro:
			"AI visibility describes whether a brand, product, or source appears in sampled AI-generated answers. It is a measurement of observed responses, not a count of every user conversation.",
		example: {
			heading: "Example metric",
			text: "Attempt 20 prompts in one product. Capture 18 complete answers; 2 runs fail. If 7 complete answers mention the brand, report 7/18 (38.9%) and 2 failed runs. A failed capture is missing data, not a confirmed absence. This is an illustrative mention rate, not OneGlanse’s model-backed visibility score.",
		},
		sections: [
			{
				heading: "What to measure",
				paragraphs: [
					"Start with the prompt and answer. Record brand mentions, recommendation order, descriptions, cited URLs, provider, account or location context, and run time. Keep the raw answer so a reader can audit the metric. Define what counts as a mention before scoring, including aliases and names shared by several brands.",
					"Separate answer mentions from citations. A brand can appear without its own site being cited; a source can be cited without an explicit brand recommendation.",
				],
			},
			{
				heading: "Build a useful prompt set",
				paragraphs: [
					"Include category, problem, comparison, and purchase-intent prompts that real buyers might ask. Write the list before running the study. Keep prompts stable across repeated runs and record any change.",
					"Group results by topic and product. Report attempted runs, valid captures, and failures beside each rate. Apply the same rule across dates; a changing denominator can distort a trend.",
				],
			},
			{
				heading: "Interpret the sample",
				paragraphs: [
					"Generated answers vary with wording, account state, location, retrieval, and time. Show the sample size and collection method. Repeat the same prompts and inspect the variation before treating a small change as a trend. These samples do not measure every private user conversation.",
				],
			},
		],
		sources: [
			google,
			{
				label: "OneGlanse collection methodology",
				url: "https://oneglanse.com/methodology",
			},
		],
	},
	{
		slug: "answer-engine-optimization",
		title: "Answer engine optimization (AEO)",
		description:
			"Publish clear, verifiable answers. Learn what to improve, how to keep pages crawlable, and which outcomes to measure.",
		intro:
			"AEO is work that helps answer systems find, understand, and cite accurate information about a subject. The term has no single technical standard or guaranteed ranking formula.",
		example: {
			heading: "Example improvement",
			text: "A pricing page says only “contact sales.” If buyers ask whether a free plan exists, publish a direct answer with the actual plan terms and update date. Then check whether sampled answers describe the plan correctly. Publishing an answer does not guarantee retrieval or a citation.",
		},
		sections: [
			{
				heading: "Start with the answer",
				paragraphs: [
					"For each important question, publish a direct, checkable answer. Name the entity, define terms, state limits, and link to primary evidence. Use headings that match the question a reader is trying to resolve.",
					"Update product facts at their source. If a pricing, feature, or availability claim changes, stale copies across several pages make the answer less reliable.",
				],
			},
			{
				heading: "Keep the site accessible",
				paragraphs: [
					"Make important text available in crawlable HTML. Use descriptive titles, internal links, canonical URLs, and a sitemap. For Google AI features, Google says established Search best practices remain relevant; no special AI schema or new AI text file is required. A page must be indexed and eligible for a Search snippet to qualify as a supporting link. Eligibility does not guarantee inclusion.",
				],
			},
			{
				heading: "Measure outcomes",
				paragraphs: [
					"Track cited URLs and brand mentions separately across a fixed prompt set. Inspect the exact response before calling a change an improvement. Referral traffic and conversions are separate outcomes from appearing in an answer.",
				],
			},
		],
		sources: [
			google,
			{
				label: "Google Search Essentials",
				url: "https://developers.google.com/search/docs/essentials",
			},
		],
	},
	{
		slug: "generative-engine-optimization",
		title: "Generative engine optimization (GEO)",
		description:
			"Plan a GEO study with stable prompts, saved responses, and repeat runs. Separate observed changes from causal claims.",
		intro:
			"GEO studies and improves how content appears in answers produced by generative search systems. The term describes a goal; results depend on the system, prompt set, and measurement method.",
		example: {
			heading: "Example study",
			text: "Freeze 30 category prompts, a location, and the products to test. Save baseline responses and citations. Correct one outdated product fact on the canonical page. Run the same prompts again across several dates, keeping an unchanged topic as a comparison. Report the samples and failures. A before-and-after difference alone does not prove that the page edit caused it.",
		},
		sections: [
			{
				heading: "What the research measures",
				paragraphs: [
					"The foundational GEO paper framed visibility as a measurable property of generated answers and tested content changes in an experimental setting. Its findings do not establish a universal gain for every site or engine.",
				],
			},
			{
				heading: "A practical workflow",
				paragraphs: [
					"Choose a stable set of relevant prompts. Capture answers and cited sources on a schedule. Identify missing or inaccurate facts about your product, then improve the original pages that should answer those questions.",
					"Publish evidence that others can verify: product documentation, methods, definitions, comparisons, and original measurements. Repeat the same prompt set after a change and keep the raw responses. Log provider updates, account changes, and other page edits that could affect the result.",
				],
			},
			{
				heading: "Limits",
				paragraphs: [
					"A mention is not a conversion. A citation is not proof that the answer is correct. One product interface and its model API may return different answers, so do not combine them without recording the collection surface.",
				],
			},
		],
		sources: [
			paper,
			google,
			{
				label: "OneGlanse collection methodology",
				url: "https://oneglanse.com/methodology",
			},
		],
	},
	{
		slug: "aeo-vs-geo-vs-seo",
		title: "AEO vs GEO vs SEO",
		description:
			"Compare the goals and measurements behind SEO, AEO, and GEO. Understand where the terms overlap.",
		intro:
			"SEO focuses on search discoverability. AEO focuses on useful, accurate answers. GEO focuses on visibility in generated responses. The terms overlap; they are working labels, not three separate technical standards.",
		example: {
			heading: "Use the right measure",
			text: "For “best CRM for a small agency,” SEO asks whether your page appears and earns clicks in search. AEO asks whether an answer cites the page and states its facts correctly. GEO asks how your brand appears in sampled generated responses. These can move in different directions.",
		},
		sections: [
			{
				heading: "SEO: search results",
				paragraphs: [
					"Typical observations include indexed pages, impressions, rankings, clicks, and organic conversions. The unit is usually a query and a result page. Google includes traffic from AI Overviews and AI Mode in the Web search type in Search Console; this is not a separate AI visibility score.",
				],
			},
			{
				heading: "AEO: answer selection",
				paragraphs: [
					"The question is whether an answer system uses your information and presents it accurately. Track the answer text, citations, and referral behavior when the product exposes them. AEO is often used as a broad name for AI answer work.",
				],
			},
			{
				heading: "GEO: generated responses",
				paragraphs: [
					"The question is how a brand or source appears in a generated response for a defined prompt set. Track mentions, descriptions, recommendations, citations, and changes over time. State the engine and collection surface.",
				],
			},
			{
				heading: "Where they meet",
				paragraphs: [
					"Accessible, accurate pages help traditional search and can also provide source material for AI features. Google says its Search best practices apply to AI Overviews and AI Mode. A single page can serve all three goals. Report search performance, answer accuracy, mentions, and citations as separate outcomes rather than calling them one ranking.",
				],
			},
		],
		sources: [google, paper],
	},
];
