import type {
	ModelCandidate,
	Provider,
	SelectorField,
	SelectorProfile,
	SelectorSnapshot,
	SelectorStage,
	SnapshotCandidate,
} from "@oneglanse/types";
import { toErrorMessage } from "@oneglanse/errors";
import { chatgpt } from "@oneglanse/services";
import { logger } from "@oneglanse/utils";
import {
	SELECTOR_MODEL,
	SELECTOR_MODEL_RATE_LIMIT_TTL_MS,
	SELECTOR_PROFILE_VERSION,
	MAX_SELECTOR_MODEL_CALLS_PER_PROCESS,
	selectorModelState,
} from "./constants.js";
import { STAGE_REQUIRED_FIELDS, SelectorProfileSchema, compactSelectors } from "./utils.js";

export function isSelectorModelRateLimited(): boolean {
	if (Date.now() >= selectorModelState.disabledUntil) {
		selectorModelState.disabledUntil = 0;
		selectorModelState.rateLimitLogged = false;
		return false;
	}
	return true;
}

export function isSelectorModelErrorRateLimit(error: unknown): boolean {
	const message = toErrorMessage(error).toLowerCase();
	return /429|quota|insufficient_quota|rate.?limit|billing/.test(message);
}

export function shouldSkipSelectorModelForBudget(): boolean {
	if (selectorModelState.callsThisProcess < MAX_SELECTOR_MODEL_CALLS_PER_PROCESS) {
		return false;
	}
	if (!selectorModelState.budgetLogged) {
		logger.warn(
			`selector model budget exhausted (${MAX_SELECTOR_MODEL_CALLS_PER_PROCESS} calls this process) — using cache only until restart`,
		);
		selectorModelState.budgetLogged = true;
	}
	return true;
}

export function buildSystemPrompt(stage: SelectorStage): string {
	// Shared rules applied to every stage.
	// Keep this tight — every extra sentence costs tokens and dilutes strict rules.
	const shared =
		"You receive a DOM snapshot and output CSS selectors. Return only JSON. " +
		"STRICT RULES: " +
		"(1) Copy selector values EXACTLY as they appear in each candidate's selector field — never modify or synthesize one. " +
		"(2) Return [] for any field you cannot identify with certainty — never guess. " +
		"(3) Selector stability order (prefer the highest available): " +
		"name/aria-label/placeholder > data-testid/data-test/data-qa > role/contenteditable > id > classes > positional. " +
		"When multiple selectors are available, ALWAYS prefer the highest-priority type even if a lower-priority one also matches. " +
		"NEVER use id or class tokens that are build-tool generated: 8 chars or fewer, mixed upper and lower case, no hyphen or underscore (e.g. #APjFqb, .jloFI, .xPaR2). " +
		"Recognisable camelCase library names are stable and allowed (e.g. .ProseMirror, .CodeMirror, .DraftEditor). " +
		"All-lowercase tokens with hyphens or underscores are always stable (e.g. .chat-message, #send-button). " +
		"If the only available selectors are build-tool hash tokens, return []. " +
		"(4) Never choose broad page wrappers, historical conversation turns, or elements that span multiple responses. " +
		"(5) Prefer attribute selectors ([data-testid=...], [aria-label=...], [role=...]) over class or id selectors whenever the attribute is semantic and not auto-generated.";

	if (stage === "compose") {
		return `${shared} Task: identify editor only. Choose the single element a real user types their prompt into. Reject: search bars, filters, sidebars, settings, hidden inputs, read-only areas.`;
	}

	if (stage === "submit") {
		return `${shared} Task: identify submitButton only. Text is already typed. Choose the visible button that sends the current prompt. Reject: voice, attach, model-picker, stop, regenerate, navigation buttons. If only Enter submits and no button exists, return [].`;
	}

	if (stage === "response") {
		return `${shared} Task: identify response, generationIndicator, and sourcesButton. response: the outermost container of the LATEST model answer only — not a child paragraph, code block, or whole-page wrapper. Must contain the full answer text, must be absent for prior turns, must persist after streaming ends. Reject any candidate that contains editable elements, user input, or multiple historical answers. generationIndicator: a small UI element (stop button, spinner, live-region) that is ONLY visible while the answer is streaming and disappears when complete. Must not contain the answer body. Return [] if no such element is visible. sourcesButton: the control that opens citations/sources for this latest answer only. Return [] if absent.`;
	}

	return `${shared} Task: identify sourcePanel and sourceItem. The sources UI is already open. sourcePanel: the smallest stable container that holds only the source list for the latest answer — not sidebars, nav, or the full document. sourceItem: the repeating element (card, row, anchor) for each individual source inside that panel. If panel and items are nested, choose the repeated items for sourceItem and their direct container for sourcePanel.`;
}

export function toModelCandidate(candidate: SnapshotCandidate): ModelCandidate {
	return {
		selector: candidate.selector,
		tag: candidate.tag,
		role: candidate.role,
		type: candidate.type,
		top: candidate.top,
		height: candidate.height,
		depth: candidate.depth,
		text: candidate.text.slice(0, 180),
		textLength: candidate.textLength,
		name: candidate.name,
		ariaLabel: candidate.ariaLabel,
		placeholder: candidate.placeholder,
		linkCount: candidate.linkCount,
		buttonCount: candidate.buttonCount,
		inputLike: candidate.inputLike,
		buttonLike: candidate.buttonLike,
		contentEditable: candidate.contentEditable,
		disabled: candidate.disabled,
		groupCount: candidate.groupCount,
		sampleItems: candidate.sampleItems?.slice(0, 2).map((item) => ({
			text: item.text.slice(0, 120),
			linkCount: item.linkCount,
			buttonCount: item.buttonCount,
		})),
		fingerprint: candidate.fingerprint,
	};
}

export function buildModelSnapshotPayload(
	stage: SelectorStage,
	snapshot: SelectorSnapshot,
): {
	providerUrl: string;
	title: string;
	editables: ModelCandidate[];
	buttons: ModelCandidate[];
	content: ModelCandidate[];
	groups: ModelCandidate[];
	requiredFields: SelectorField[];
} {
	const limits: Record<
		SelectorStage,
		{ editables: number; buttons: number; content: number; groups: number }
	> = {
		compose: { editables: 10, buttons: 6, content: 4, groups: 4 },
		submit: { editables: 6, buttons: 15, content: 6, groups: 4 },
		response: { editables: 4, buttons: 12, content: 14, groups: 10 },
		sources: { editables: 2, buttons: 6, content: 10, groups: 10 },
	};
	const limit = limits[stage];

	return {
		providerUrl: snapshot.url,
		title: snapshot.title,
		editables: snapshot.editables
			.slice(0, limit.editables)
			.map(toModelCandidate),
		buttons: snapshot.buttons.slice(0, limit.buttons).map(toModelCandidate),
		content: snapshot.content.slice(0, limit.content).map(toModelCandidate),
		groups: snapshot.groups.slice(0, limit.groups).map(toModelCandidate),
		requiredFields: STAGE_REQUIRED_FIELDS[stage],
	};
}

export async function resolveProfileWithModel(
	provider: Provider,
	stage: SelectorStage,
	snapshot: SelectorSnapshot,
): Promise<SelectorProfile | null> {
	const modelPayload = buildModelSnapshotPayload(stage, snapshot);
	const response = await chatgpt.responses.create({
		model: SELECTOR_MODEL,
		temperature: 0,
		input: [
			{
				role: "system",
				content: buildSystemPrompt(stage),
			},
			{
				role: "user",
				content: JSON.stringify({
					provider,
					stage,
					...modelPayload,
				}),
			},
		],
		text: {
			format: {
				type: "json_schema",
				name: `selector_profile_${stage.replace(/[^a-z0-9_-]/gi, "_")}`,
				strict: true,
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						editor: {
							type: "array",
							items: { type: "string" },
						},
						submitButton: {
							type: "array",
							items: { type: "string" },
						},
						response: {
							type: "array",
							items: { type: "string" },
						},
						generationIndicator: {
							type: "array",
							items: { type: "string" },
						},
						sourcesButton: {
							type: "array",
							items: { type: "string" },
						},
						sourcePanel: {
							type: "array",
							items: { type: "string" },
						},
						sourceItem: {
							type: "array",
							items: { type: "string" },
						},
					},
					required: [
						"editor",
						"submitButton",
						"response",
						"generationIndicator",
						"sourcesButton",
						"sourcePanel",
						"sourceItem",
					],
				},
			},
		},
	});

	const output = response.output_text?.trim();
	if (!output) {
		return null;
	}

	const parsed = SelectorProfileSchema.safeParse(JSON.parse(output));
	if (!parsed.success) {
		throw new Error(parsed.error.message);
	}

	return {
		version: SELECTOR_PROFILE_VERSION,
		provider,
		stage,
		pageKey: snapshot.pageKey,
		fingerprint: snapshot.fingerprint,
		model: SELECTOR_MODEL,
		createdAt: new Date().toISOString(),
		selectors: compactSelectors(parsed.data),
	};
}
