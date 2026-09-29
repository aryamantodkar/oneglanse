import { ExternalServiceError, ValidationError } from "@oneglanse/errors";
import type { AnalysisInputSingle, BrandAnalysisResult } from "@oneglanse/types";
import { env } from "../env.js";
import { chatgpt, claude } from "../llm/index.js";
import { analysisPrompt } from "./analysisPrompt.js";

const systemPrompt =
	"You are an expert brand intelligence analyst. " +
	"You respond ONLY with valid JSON — no markdown, no code fences, no commentary. " +
	"Return only valid JSON matching the requested schema. " +
	"Be precise, evidence-based, and conservative in your scoring. " +
	"If the brand is not mentioned in the response, return zeroed-out scores and empty arrays rather than fabricating data.";

async function runWithOpenAI(prompt: string, responseLength: number): Promise<string> {
	let response;
	try {
		response = await chatgpt.responses.create({
			model: env.ANALYSIS_OPENAI_MODEL,
			temperature: 0,
			input: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: prompt },
			],
			text: { format: { type: "json_object" } },
		});
	} catch (err) {
		throw new ExternalServiceError(
			"ChatGPT",
			"Failed to analyze response.",
			502,
			{ responseLength },
			err,
		);
	}
	return response.output_text?.trim() || "";
}

/**
 * Chat Completions variant. Same prompt, same JSON-object output contract, but
 * over the portable wire format that OpenAI-compatible gateways (OpenRouter,
 * LiteLLM, vLLM, ...) implement. Selected with ANALYSIS_OPENAI_API=chat.
 */
async function runWithOpenAIChat(
	prompt: string,
	responseLength: number,
): Promise<string> {
	let response;
	try {
		response = await chatgpt.chat.completions.create({
			model: env.ANALYSIS_OPENAI_MODEL,
			temperature: 0,
			// No max_tokens: capping output truncates the JSON and fails the parse.
			response_format: { type: "json_object" },
			messages: [
				{ role: "system", content: systemPrompt },
				{ role: "user", content: prompt },
			],
		});
	} catch (err) {
		throw new ExternalServiceError(
			"ChatGPT",
			"Failed to analyze response.",
			502,
			{ responseLength },
			err,
		);
	}
	return response.choices[0]?.message?.content?.trim() || "";
}

async function runWithClaude(prompt: string, responseLength: number): Promise<string> {
	let response;
	try {
		response = await claude.messages.create({
			model: "claude-sonnet-4-6",
			max_tokens: 4096,
			temperature: 0,
			system: systemPrompt,
			messages: [{ role: "user", content: prompt }],
		});
	} catch (err) {
		throw new ExternalServiceError(
			"Claude",
			"Failed to analyze response.",
			502,
			{ responseLength },
			err,
		);
	}
	const block = response.content[0];
	return block?.type === "text" ? block.text.trim() : "";
}

export async function runAnalysis(
	input: AnalysisInputSingle,
): Promise<BrandAnalysisResult> {
	const prompt = analysisPrompt(input);

	let text: string;
	if (env.ANALYSIS_LLM_PROVIDER === "claude") {
		text = await runWithClaude(prompt, input.response.length);
	} else if (env.ANALYSIS_OPENAI_API === "chat") {
		text = await runWithOpenAIChat(prompt, input.response.length);
	} else {
		text = await runWithOpenAI(prompt, input.response.length);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (err) {
		throw new ValidationError(
			"Invalid JSON returned from LLM during analysis.",
			{ rawOutput: text.slice(0, 200) },
		);
	}

	if (typeof parsed !== "object" || parsed === null) {
		throw new ValidationError("Invalid JSON shape", { type: typeof parsed });
	}

	return parsed as BrandAnalysisResult;
}
