import type { AskPromptResult } from "@oneglanse/types";

/**
 * Custom error thrown when a prompt fails all retries and needs an IP refresh
 * Carries partial results and remaining prompts to continue processing
 */
export class IPRefreshNeededError extends Error {
	public readonly partialResults: AskPromptResult[];
	public readonly remainingPrompts: { id: string; prompt: string }[];
	public readonly failedPromptIndex: number;
	public readonly failureType?: string;

	constructor(
		message: string,
		partialResults: AskPromptResult[],
		remainingPrompts: { id: string; prompt: string }[],
		failedPromptIndex: number,
		failureType?: string,
	) {
		super(message);
		this.name = "IPRefreshNeededError";
		this.partialResults = partialResults;
		this.remainingPrompts = remainingPrompts;
		this.failedPromptIndex = failedPromptIndex;
		this.failureType = failureType;
	}
}
