import { toErrorMessage } from "@oneglanse/errors";
import { chatgpt } from "@oneglanse/services";
import type {
	ModelCandidate,
	Provider,
	SelectorField,
	SelectorProfile,
	SelectorSnapshot,
	SelectorStage,
	SnapshotCandidate,
} from "@oneglanse/types";
import { logger } from "@oneglanse/utils";
import {
	MAX_SELECTOR_MODEL_CALLS_PER_PROCESS,
	SELECTOR_MODEL,
	SELECTOR_MODEL_RATE_LIMIT_TTL_MS,
	SELECTOR_PROFILE_VERSION,
	selectorModelState,
} from "./constants.js";
import {
	STAGE_REQUIRED_FIELDS,
	SelectorProfileSchema,
	compactSelectors,
} from "./utils.js";

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
	if (
		selectorModelState.callsThisProcess < MAX_SELECTOR_MODEL_CALLS_PER_PROCESS
	) {
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
		"NEVER use id, class, or data-* attribute values that are build-tool generated, per-instance, or turn-specific. Reject short mixed-case hash tokens, generated suffixes, hex/alphanumeric blobs, and ordinal tokens like *-2 or *_9c31ab12. " +
		"Recognisable camelCase library names are stable and allowed (e.g. .ProseMirror, .CodeMirror, .DraftEditor). " +
		"All-lowercase tokens with hyphens or underscores are always stable (e.g. .chat-message, #send-button). " +
		"If the only available selectors are build-tool hash tokens, generated suffix tokens, or per-turn/test-instance selectors, return []. " +
		"(4) Never choose broad page wrappers, historical conversation turns, or elements that span multiple responses. " +
		"(5) Prefer attribute selectors ([data-testid=...], [aria-label=...], [role=...]) over class or id selectors whenever the attribute is semantic and not auto-generated.";

	if (stage === "compose") {
		return `${shared} Task: identify editor only. Choose the single element a real user types their prompt into. Reject: search bars, filters, sidebars, settings, hidden inputs, read-only areas.`;
	}

	if (stage === "submit") {
		return `${shared} Task: identify submitButton only. Text is already typed. Choose the visible button that sends the current prompt. Reject: voice, attach, model-picker, stop, regenerate, navigation buttons. If only Enter submits and no button exists, return [].`;
	}

	if (stage === "response") {
		return `${shared} Task: identify response, generationIndicator, and sourcesButton. response: the outermost container of the LATEST model answer body only — not a child paragraph, code block, whole-page wrapper, research/status header, tool-use summary, reasoning/thinking panel, citation tray, metadata badge, search-result list, source-card grid, links tab, thread-history/sidebar list, or navigation rail. Must contain the full final answer text, must be absent for prior turns, and must persist after streaming ends. If a short framing/preamble sentence introduces the answer and is followed by the real structured answer, choose the container for the real answer body, not a wrapper whose main value is the preamble. Reject any candidate dominated by repeated links, result cards, history items, tabs, or internal navigation even if it contains some answer-adjacent text. Reject any candidate that contains editable elements, user input, multiple historical answers, or short status/label rows that describe the answer instead of being the answer itself. generationIndicator: a small UI element (stop button, spinner, live-region) that is ONLY visible while the answer is streaming and disappears when complete. Must not contain the answer body. Return [] if no such element is visible. sourcesButton: the control that opens citations/sources for this latest answer only. If citations are inline inside the answer and there is no separate sources control, return [].`;
	}

	return `${shared} Task: identify sourcePanel and sourceItem. The sources UI is already visible, either as an opened sources region or as inline citations embedded in the latest answer. sourcePanel: return a selector for EVERY distinct container that holds a source list for the latest answer. GROUPING RULE: when multiple sibling lists (ul, ol, div) exist inside a single parent container, return the PARENT container as sourcePanel — not the individual sibling lists. Only return individual list elements as separate sourcePanel entries when they are in genuinely separate UI regions (e.g. a side panel AND an inline tray). The goal is one sourcePanel selector per distinct UI region, where each selector encompasses all source items within that region. Some providers render citations in multiple separate locations; include a selector for each distinct region. Do not include the full document, page root, or top-level layout wrappers. If citations are inline chips/badges embedded directly inside paragraphs, tables, or list items, the sourcePanel should be the narrowest answer-region container that contains those citation chips and only the latest answer content. sourceItem: the single most generic selector that matches all individual source cards, rows, anchors, or inline citation chips/badges across ALL panels — it must work inside every sourcePanel container. sourceItem does NOT need to be an anchor; it can be a clickable citation chip/span/button if that is what the UI visibly renders as the citation. If items differ by panel, prefer the selector that matches the most items.`;
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
