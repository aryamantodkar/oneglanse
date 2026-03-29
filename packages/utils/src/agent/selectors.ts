export const SELECTORS = {
	chatgpt: {
		flyout: {
			threadFlyout: 'div[class*="threadFlyOut"]',
			aside: "aside",
			dialog: '[role="dialog"]',
			testId: '[data-testid*="sources"]',
			classSources: '[class*="sources"]',
			classCitation: '[class*="citation"]',
		},
		anchor: 'a[href^="http"]',
		listItem: "li",
		img: "img",
	},
	gemini: {
		sourceCard: "inline-source-card",
		anchor: "a",
		title: ".title",
		titleFallback: ".source-path",
		snippet: ".snippet",
		icon: "img.icon-image, img",
	},
	perplexity: {
		anchor: 'a[href^="http"]',
		img: "img",
	},
} as const;
