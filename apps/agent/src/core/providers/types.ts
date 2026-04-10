import type { Source } from "@oneglanse/types";
import type { Page } from "playwright";

export interface SubmitSuccessContext {
	preSubmitUrl: string;
}

/**
 * Declares all per-provider behavior in one place.
 *
 * To add a new provider: create a new config file that satisfies this interface
 * and register it in providers/index.ts. No other files need to change.
 */
export interface ProviderConfig {
	/** Landing URL the browser navigates to before sending prompts. */
	url: string;
	/** Short identifier used in logs (e.g. "ChatGPT"). */
	label: string;
	/** Human-readable product name shown in the UI (e.g. "ChatGPT"). */
	displayName: string;
	/** Set true to skip this provider in all job runs. */
	skip?: boolean;
	/**
	 * When true, createAgent skips the initial navigation to config.url.
	 * Use this for providers that navigate per-prompt via navigateToPrompt,
	 * making the base URL navigation redundant.
	 */
	skipInitialNavigation?: boolean;
	/** Waits until the AI response is fully generated and ready to read. */
	waitForResponse: (page: Page) => Promise<void>;
	/** Reads the AI response from the page and returns it as markdown. */
	extractResponse: (page: Page) => Promise<string>;
	/**
	 * Runs immediately before response extraction begins.
	 * Use this to normalize viewport state for providers whose answers are not
	 * chat-style bottom-of-page threads.
	 */
	beforeResponseExtractionHook?: (page: Page) => Promise<void>;
	/**
	 * Controls the generic viewport adjustment before extraction.
	 * "bottom" matches chat UIs, "top" matches search-style answer cards,
	 * and "none" leaves scroll position untouched.
	 */
	responseScrollBehavior?: "bottom" | "top" | "none";
	/** Called immediately before locating/typing into the editor. */
	beforePromptHook?: (page: Page) => Promise<void>;
	/** Called right after typing completes, before submit preparation. */
	afterTypingHook?: (page: Page) => Promise<void>;
	/** Called immediately before the submit attempt — e.g. dismiss autocomplete dropdowns. */
	beforeSubmitHook?: (page: Page) => Promise<void>;
	/** Called immediately after submit and stabilization, before response waiting begins. */
	afterSubmitHook?: (page: Page) => Promise<void>;
	/** Called between consecutive prompts — e.g. reset the page to its initial state. */
	betweenPromptsHook?: (page: Page) => Promise<void>;
	/**
	 * Override the submission strategy order for this provider.
	 * Defaults to ["native", "enter", "force", "dispatch"] when unset.
	 * Strategies not in the array are skipped entirely.
	 */
	submitOrder?: Array<"native" | "enter" | "force" | "dispatch">;
	/**
	 * Provider-specific check for whether a prompt was submitted successfully.
	 * Return true/false to short-circuit; return undefined to fall through to generic checks.
	 */
	checkSubmitSuccess?: (
		page: Page,
		context: SubmitSuccessContext,
	) => Promise<boolean | undefined>;
	/**
	 * Optional post-processing hook for extracted sources.
	 * Called after source extraction completes — use to filter or transform
	 * provider-specific noise (e.g. Google account/policy links in AI Overview).
	 */
	sanitizeSources?: (sources: Source[]) => Source[];
	/** Runs before the browser navigates to the provider URL. */
	preNavigationHook?: (page: Page) => Promise<void>;
	/** Runs after the browser lands on the provider URL. */
	postNavigationHook?: (page: Page) => Promise<void>;
	/**
	 * When set, replaces the normal type-and-submit flow entirely.
	 * The hook receives the prompt text and is responsible for navigating
	 * the page to the state where `waitForResponse` can be called.
	 * Used by providers that need a fully custom per-prompt navigation flow.
	 */
	navigateToPrompt?: (page: Page, prompt: string) => Promise<void>;
}
