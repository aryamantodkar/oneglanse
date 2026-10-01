export type Guide = {
	slug: string;
	title: string;
	intro: string;
	example: { heading: string; text: string };
	sections: { heading: string; paragraphs: string[] }[];
	sources: { label: string; url: string }[];
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
		intro:
			"AI visibility describes whether a brand, product, or source appears in sampled AI-generated answers. It is a measurement of observed responses, not a count of every user conversation.",
		example: {
			heading: "Example metric",
			text: "Run 20 fixed prompts once in one product. If a brand appears in 7 captured answers, its observed mention rate is 7/20 for that prompt set and run. Report the product, date, account context, and incomplete runs beside the rate.",
		},
		sections: [
			{
				heading: "What to measure",
				paragraphs: [
					"Start with the prompt and answer. Record brand mentions, recommendation order, descriptions, cited URLs, provider, account or location context, and run time. Keep the raw answer so a reader can audit the metric.",
					"Separate answer mentions from citations. A brand can appear without its own site being cited; a source can be cited without an explicit brand recommendation.",
				],
			},
			{
				heading: "Build a useful prompt set",
				paragraphs: [
					"Include category, problem, comparison, and purchase-intent prompts that real buyers might ask. Write the list before running the study. Keep prompts stable across repeated runs and record any change.",
					"Group results by topic and product. A single aggregate score can hide the prompts where a brand never appears.",
				],
			},
			{
				heading: "Interpret the sample",
				paragraphs: [
					"Generated answers vary with wording, account state, location, retrieval, and time. Show the sample size and collection method. A trend is more useful than one answer, but neither is a census of private user conversations.",
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
		intro:
			"AEO is work that helps answer systems find, understand, and cite accurate information about a subject. The term has no single technical standard or guaranteed ranking formula.",
		example: {
			heading: "Example improvement",
			text: "A pricing page says only “contact sales.” If buyers ask whether a free plan exists, publish a direct answer with the actual plan terms and update date. Then check whether sampled answers describe the plan correctly; do not infer success from markup alone.",
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
					"Make important text available in crawlable HTML. Use descriptive titles, internal links, canonical URLs, and a sitemap. For Google AI features, Google says established Search best practices remain relevant; no separate AI-specific markup is required.",
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
		intro:
			"GEO studies and improves how content appears in answers produced by generative search systems. The term describes a goal; results depend on the system, prompt set, and measurement method.",
		example: {
			heading: "Example study",
			text: "Freeze 30 category prompts, a location, and the products to test. Save baseline responses and citations. Correct one outdated product fact on the canonical page. Run the same prompts again across several dates. Report both samples, changes, and any collection failures; do not attribute every difference to that edit.",
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
					"Publish evidence that others can verify: product documentation, methods, definitions, comparisons, and original measurements. Re-run the same prompt set after a change and keep the raw responses.",
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
		intro:
			"SEO focuses on discoverability in search results. AEO focuses on answers. GEO focuses on visibility in generated answers. These labels overlap; the measurements should be explicit.",
		example: {
			heading: "Use the right measure",
			text: "For “best CRM for a small agency,” SEO asks whether your page appears and earns clicks in search. AEO asks whether an answer cites the page and states its facts correctly. GEO asks how your brand appears in sampled generated responses. These can move in different directions.",
		},
		sections: [
			{
				heading: "SEO: search results",
				paragraphs: [
					"Typical observations include indexed pages, impressions, rankings, clicks, and organic conversions. The unit is usually a search query and a result page.",
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
					"Accessible, accurate pages help traditional search and can also provide source material for AI features. Google says its Search best practices apply to AI Overviews and AI Mode. None of the three labels removes the need to test with real prompts and inspect what users see.",
				],
			},
		],
		sources: [google, paper],
	},
];
