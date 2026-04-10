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
		return (
			`${shared} ` +
			"Your task: identify the SINGLE editable element where a user types their message. " +
			"Return: { \"editor\": [\"css-selector\"] } " +
			"Pick the primary text input/contenteditable/textarea for message composition. " +
			"Prefer the element the user would click to start typing. Return [] if no editor found."
		);
	}

	if (stage === "submit") {
		return (
			`${shared} ` +
			"Your task: identify the SINGLE visible button that sends/submits the composed message. " +
			"Return: { \"submitButton\": [\"css-selector\"] } " +
			"Pick the primary send/submit/enter button. It must be visible and interactive right now. " +
			"Reject: voice, attach, model-picker, stop, regenerate, navigation buttons. " +
			"Return [] if no submit button is visible."
		);
	}

	if (stage === "response") {
		return (
			`${shared} ` +
			"Your task: identify the container for the latest AI response, and optionally the button that opens the sources panel. " +
			"Return: { \"response\": [\"css-selector\"], \"sourcesButton\": [\"css-selector\"] } " +
			"\"response\": the stable element wrapping the most recent complete answer text. Must contain substantial prose (not just a loading spinner). " +
			"IMPORTANT: Content candidates are ordered by relevance — the FIRST content candidates are the most likely latest AI response. Prefer selectors from earlier candidates unless the screenshot clearly shows otherwise. " +
			"When a screenshot is provided, cross-check your selection against the visually prominent response area in the screenshot. " +
			"Prefer the smallest stable container that still contains the whole answer. Reject wrappers for layout, navigation, history, or multiple turns. Reject candidates with editable descendants. " +
			"\"sourcesButton\": the control (button/tab) that, when clicked, reveals source citations. " +
			"CRITICAL: choose a sourcesButton ONLY if the visible text, aria-label, or title explicitly contains the word \"sources\". " +
			"It will always say \"sources\". Never choose controls labeled links, related links, references, citations, tabs, web, search, results, or anything else. " +
			"If no control explicitly says \"sources\", return []. " +
			"Inline sources/citations will always still be present in the response body."
		);
	}

	return (
		`${shared} ` +
		"Your task: identify the sources panel container and individual source item selectors. " +
		"Return: { \"sourcePanel\": [\"css-selector\"], \"sourceItem\": [\"css-selector\"] } " +
		"\"sourcePanel\": the visible container holding source/citation cards. May be a sidebar, drawer, or inline section. " +
		"GROUPING RULE: when multiple sibling lists exist inside a single parent, return the PARENT as sourcePanel — not the individual sibling lists. " +
		"Only return individual list elements as separate sourcePanel entries when they are in genuinely separate UI regions. " +
		"Do not include the full document, page root, or top-level layout wrappers. " +
		"\"sourceItem\": the selector matching individual source cards or citation links WITHIN the sourcePanel. " +
		"CRITICAL: sourceItem MUST be scoped to distinguish source cards from surrounding navigation and UI elements. " +
		"Generic document-wide selectors like \"a\", \"div\", \"li\", \"span\" that would match hundreds of unrelated elements on the page are INVALID — return [] instead. " +
		"The selector should be specific enough that querying document.querySelectorAll(sourceItem) inside the sourcePanel returns only source citation cards, not nav links, buttons, or other UI. " +
		"If no sources panel or citations are visible in the screenshot, return [] for both fields."
	);
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
		blockCount: candidate.blockCount,
		childCount: candidate.childCount,
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
	screenshotBase64?: string,
): Promise<SelectorProfile | null> {
	const modelPayload = buildModelSnapshotPayload(stage, snapshot);

	const stageSchemas: Record<
		SelectorStage,
		{ properties: Record<string, unknown>; required: string[] }
	> = {
		compose: {
			properties: {
				editor: { type: "array", items: { type: "string" } },
			},
			required: ["editor"],
		},
		submit: {
			properties: {
				submitButton: { type: "array", items: { type: "string" } },
			},
			required: ["submitButton"],
		},
		response: {
			properties: {
				response: { type: "array", items: { type: "string" } },
				sourcesButton: { type: "array", items: { type: "string" } },
			},
			required: ["response", "sourcesButton"],
		},
		sources: {
			properties: {
				sourcePanel: { type: "array", items: { type: "string" } },
				sourceItem: { type: "array", items: { type: "string" } },
			},
			required: ["sourcePanel", "sourceItem"],
		},
	};

	const { properties, required } = stageSchemas[stage];

	// For response and sources stages, include a page screenshot when available.
	// Visual context lets the model distinguish the response container and sources
	// panel from surrounding navigation/UI chrome — critical for accuracy.
	const useScreenshot =
		screenshotBase64 &&
		(stage === "response" || stage === "sources");

	const userMessageContent: unknown = useScreenshot
		? [
				{
					type: "input_text",
					text: JSON.stringify({ provider, stage, ...modelPayload }),
				},
				{
					type: "input_image",
					image_url: `data:image/jpeg;base64,${screenshotBase64}`,
				},
			]
		: JSON.stringify({ provider, stage, ...modelPayload });

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
				content: userMessageContent as string,
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
					properties,
					required,
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
