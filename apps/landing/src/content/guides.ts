import type { Source } from "./sources";

type Guide = {
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
			"AI visibility is how often your brand shows up in a set of AI answers you chose to track. It does not tell you what every ChatGPT or Gemini user sees.",
		example: {
			heading: "Example metric",
			text: "Run 20 prompts in one product. If 18 return answers and 7 of those mention your brand, report 7/18 (38.9%) and 2 failed runs. A failed run is missing data, not proof that the brand was absent. Mention rate and the visibility score from your analysis model are different measures.",
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
				heading: "Don’t overread small changes",
				paragraphs: [
					"Change the wording, account, location, or date and you may get a different answer. Show how many runs you made and how you got the answers. Repeat prompts before calling a small change a trend.",
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
			"AEO is a loose name for making your site easier for answer engines to understand and cite. There is no official AEO standard or guaranteed ranking formula.",
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
				heading: "Check whether anything changed",
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
			"GEO is the name people use for improving how a brand or website appears in AI-generated answers. There is no universal GEO score or recipe.",
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
				heading: "What to measure",
				paragraphs: [
					"Choose a stable set of relevant prompts. Capture answers and cited sources on a schedule. Identify missing or inaccurate facts about your product, then improve the original pages that should answer those questions.",
					"Publish evidence that others can verify: product documentation, methods, definitions, comparisons, and original measurements. Repeat the same prompt set after a change and keep the raw responses. Log provider updates, account changes, and other page edits that could affect the result.",
				],
			},
			{
				heading: "Limits",
				paragraphs: [
					"A mention is not a conversion. A citation does not prove that the answer is correct. An AI website and its model API may return different answers, so record which one you used.",
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
			"SEO, AEO, and GEO overlap more than the names suggest. SEO asks whether people find you in search. AEO asks whether an answer engine can use your information. GEO asks how you show up in generated answers.",
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
					"Look at how your brand or site appears for a fixed set of prompts. Track mentions, descriptions, recommendations, citations, and changes over time. Name the AI product and say whether you used its website or API.",
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
