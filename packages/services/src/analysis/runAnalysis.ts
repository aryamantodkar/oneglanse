import { ExternalServiceError, ValidationError } from "@oneglanse/errors";
import type { AnalysisInputSingle, BrandAnalysisResult } from "@oneglanse/types";
import { chatgpt } from "../llm/index.js";
import { analysisPrompt } from "./analysisPrompt.js";

export async function runAnalysis(
	input: AnalysisInputSingle,
): Promise<BrandAnalysisResult> {
	const prompt = analysisPrompt(input);

	const systemPrompt =
		"You are an expert brand intelligence analyst. " +
		"You respond ONLY with valid JSON — no markdown, no code fences, no commentary. " +
		"Return only valid JSON matching the requested schema. " +
		"Be precise, evidence-based, and conservative in your scoring. " +
		"If the brand is not mentioned in the response, return zeroed-out scores and empty arrays rather than fabricating data.";

	let response;
	try {
		response = await chatgpt.responses.create({
			model: "gpt-4.1",
			temperature: 0,
			input: [
				{
					role: "system",
					content: systemPrompt,
				},
				{
					role: "user",
					content: prompt,
				},
			],
			text: {
				format: { type: "json_object" },
			},
		});
	} catch (err) {
		throw new ExternalServiceError(
			"ChatGPT",
			"Failed to analyze response.",
			502,
			{ responseLength: input.response.length },
			err,
		);
	}

	const text = response.output_text?.trim() || "";

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
