import { createHash } from "node:crypto";
import type {
	SelectorField,
	SelectorSnapshot,
	SelectorStage,
} from "@oneglanse/types";
import { z } from "zod";
import { MAX_SELECTORS_PER_FIELD } from "./constants.js";

export const STAGE_REQUIRED_FIELDS: Record<SelectorStage, SelectorField[]> = {
	compose: ["editor"],
	submit: ["submitButton"],
	response: ["response", "generationIndicator", "sourcesButton"],
	sources: ["sourcePanel", "sourceItem"],
};

export const SelectorProfileSchema = z.object({
	editor: z.array(z.string()).default([]),
	submitButton: z.array(z.string()).default([]),
	response: z.array(z.string()).default([]),
	generationIndicator: z.array(z.string()).default([]),
	sourcesButton: z.array(z.string()).default([]),
	sourcePanel: z.array(z.string()).default([]),
	sourceItem: z.array(z.string()).default([]),
});

export function defaultSelectorRecord(): Record<SelectorField, string[]> {
	return {
		editor: [],
		submitButton: [],
		response: [],
		generationIndicator: [],
		sourcesButton: [],
		sourcePanel: [],
		sourceItem: [],
	};
}

export function hashValue(input: string): string {
	return createHash("sha256").update(input).digest("hex");
}

export function normalizeSelectorToken(token: string): string {
	return token.replace(/\\/g, "").trim();
}

function splitSemanticTokenSegments(token: string): string[] {
	return token
		.split(/[-_:]+/)
		.map((segment) => segment.trim())
		.filter(Boolean);
}

function looksLikeGeneratedSegment(segment: string): boolean {
	if (!segment) {
		return false;
	}

	if (/^\d+$/.test(segment)) {
		return true;
	}

	if (/^[a-f0-9]{8,}$/i.test(segment)) {
		return true;
	}

	return (
		segment.length >= 8 &&
		/[a-z]/i.test(segment) &&
		/\d/.test(segment) &&
		!/^([a-z]+|\d+|[a-z]+\d{1,2})$/i.test(segment)
	);
}

function hasGeneratedTokenShape(token: string): boolean {
	const segments = splitSemanticTokenSegments(token);
	if (segments.length === 0) {
		return false;
	}
	if (
		segments.length >= 4 &&
		segments.filter((segment) => segment.length <= 2).length >= 2
	) {
		return true;
	}

	if (segments.some((segment) => looksLikeGeneratedSegment(segment))) {
		return true;
	}

	const tail = segments.at(-1);
	return Boolean(tail && segments.length > 1 && /^\d+$/.test(tail));
}

export function isStableSemanticToken(token: string): boolean {
	if (!token || token.length > 40) {
		return false;
	}
	if (
		/^(active|selected|disabled|hover|focus|open|show|hide)$/i.test(token) ||
		/^\d+$/.test(token) ||
		/__[a-z0-9]{5,}$/i.test(token)
	) {
		return false;
	}
	if (hasGeneratedTokenShape(token)) {
		return false;
	}
	// Reject build-tool hash tokens: mixed case, short (≤8 chars), no separator.
	// Threshold is 8 so that real library class names (CodeMirror=10, ProseMirror=11)
	// are never rejected — all known build-hash tokens (APjFqb, jloFI, xPaR2) are ≤8.
	if (
		/[A-Z]/.test(token) &&
		/[a-z]/.test(token) &&
		!/[-_]/.test(token) &&
		token.length <= 8
	) {
		return false;
	}
	if (token.includes("-") || token.includes("_") || token.includes(":")) {
		const segments = splitSemanticTokenSegments(token);
		return (
			segments.length > 0 &&
			segments.every(
				(segment) =>
					/^[a-z]+$/.test(segment) || /^[a-z]+\d{1,2}$/i.test(segment),
			)
		);
	}
	if (!/^[a-z]+$/.test(token)) {
		return false;
	}
	return token.length >= 4;
}

function isSemanticAttributeSelector(attrName: string): boolean {
	return /^(name|aria-label|placeholder|role|type|title)$/i.test(attrName);
}

function isStabilityCheckedAttributeSelector(attrName: string): boolean {
	return (
		attrName === "id" || attrName === "class" || attrName.startsWith("data-")
	);
}

function isStableSelectorAttributeValue(
	attrName: string,
	value: string,
): boolean {
	if (!value) {
		return false;
	}

	if (isSemanticAttributeSelector(attrName)) {
		return true;
	}

	if (attrName === "class") {
		return value
			.split(/\s+/)
			.filter(Boolean)
			.every((token) => isStableSemanticToken(normalizeSelectorToken(token)));
	}

	if (isStabilityCheckedAttributeSelector(attrName)) {
		return isStableSemanticToken(normalizeSelectorToken(value));
	}

	return true;
}

export function isStableSelectorValue(selector: string): boolean {
	const tokenPattern = /([#.])((?:\\.|[A-Za-z0-9_-])+)/g;
	for (const match of selector.matchAll(tokenPattern)) {
		const tokenType = match[1];
		const tokenValue = normalizeSelectorToken(match[2] ?? "");
		if (!tokenValue) {
			continue;
		}
		if (tokenType === "#" && !isStableSemanticToken(tokenValue)) {
			return false;
		}
		if (tokenType === "." && !isStableSemanticToken(tokenValue)) {
			return false;
		}
	}

	const attributePattern = /\[([a-zA-Z0-9_-]+)(?:[*^$|~]?=)(["'])(.*?)\2\]/g;
	for (const match of selector.matchAll(attributePattern)) {
		const attrName = (match[1] ?? "").trim().toLowerCase();
		const attrValue = normalizeSelectorToken(
			(match[3] ?? "").replace(/\\"/g, '"').replace(/\\'/g, "'"),
		);
		if (
			attrName &&
			attrValue &&
			!isStableSelectorAttributeValue(attrName, attrValue)
		) {
			return false;
		}
	}

	return true;
}

export function compactSelectors(
	input: z.infer<typeof SelectorProfileSchema>,
): Record<SelectorField, string[]> {
	const base = defaultSelectorRecord();
	for (const field of Object.keys(base) as SelectorField[]) {
		let values = (input[field] ?? [])
			.map((value) => value.trim())
			.filter(Boolean);

		// Strip :nth-of-type(N) from response selectors. The fingerprint already
		// normalizes these numbers so the same fingerprint is reused across prompts,
		// but keeping the ordinal in the actual selector makes it permanently point
		// to the first response container. extractResponsePayload uses .at(-1) to
		// get the latest match, so an unanchored selector works correctly.
		if (
			field === "response" ||
			field === "sourcePanel" ||
			field === "sourceItem"
		) {
			values = values.map((value) =>
				value.replace(/:nth-of-type\(\d+\)/g, "").trim(),
			);
		}

		base[field] = [...new Set(values.filter(isStableSelectorValue))].slice(
			0,
			MAX_SELECTORS_PER_FIELD,
		);
	}
	return base;
}

export function normalizePageKeySegment(segment: string): string {
	if (/^[0-9a-f-]{16,}$/i.test(segment)) {
		return ":id";
	}

	if (segment.length >= 24) {
		const parts = segment.split(/[-_.]+/).filter(Boolean);
		const hasDynamicShape = parts.some(
			(part) =>
				part.includes(":") ||
				/\d/.test(part) ||
				/[A-Z]/.test(part) ||
				/^[0-9a-f]{6,}$/i.test(part),
		);
		if (parts.length >= 3 && hasDynamicShape) {
			return ":id";
		}
	}

	return segment.replace(/\d+/g, ":n");
}

export function normalizePageKey(pageKey: string): string {
	const [host, ...segments] = pageKey.split("/").filter(Boolean);
	if (!host) {
		return "unknown";
	}

	const normalizedSegments = segments
		.slice(0, 2)
		.map((segment) => normalizePageKeySegment(segment));

	return [host, ...normalizedSegments].join("/");
}

export function buildPageKey(rawUrl: string): string {
	try {
		const url = new URL(rawUrl);
		const segments = url.pathname.split("/").filter(Boolean).slice(0, 2);
		return normalizePageKey(`${url.hostname}/${segments.join("/")}`);
	} catch {
		return "unknown";
	}
}

export function normalizeSelectorForState(selector: string): string {
	return selector.replace(/:nth-of-type\(\d+\)/g, ":nth-of-type");
}

export function buildSnapshotStateKey(snapshot: SelectorSnapshot): string {
	// Same invariant as the snapshot fingerprint: deduplicated sorted selector
	// sets. Per-element text, ariaLabel, and fingerprint values change between
	// prompts even when the page structure is identical — excluding them prevents
	// the state key from falsely detecting a "new" page state on every prompt.
	return hashValue(
		JSON.stringify({
			stage: snapshot.stage,
			pageKey: snapshot.pageKey,
			editables: [...new Set(snapshot.editables.map((item) => normalizeSelectorForState(item.selector)))].sort(),
			buttons: [...new Set(snapshot.buttons.map((item) => normalizeSelectorForState(item.selector)))].sort(),
			content: [...new Set(snapshot.content.map((item) => normalizeSelectorForState(item.selector)))].sort(),
			groups: [...new Set(snapshot.groups.map((item) => normalizeSelectorForState(item.selector)))].sort(),
		}),
	);
}

export function hasRequiredSelectors(
	stage: SelectorStage,
	selectors: Record<SelectorField, string[]>,
	requiredFields?: readonly SelectorField[],
): boolean {
	if (requiredFields && requiredFields.length > 0) {
		return requiredFields.every((field) => selectors[field].length > 0);
	}

	if (stage === "response") {
		return selectors.response.length > 0;
	}

	if (stage === "sources") {
		// Both sourcePanel and sourceItem are required. Without sourcePanel the
		// extraction falls back to querying the whole document, which picks up
		// wrong elements from anywhere on the page.
		return selectors.sourceItem.length > 0 && selectors.sourcePanel.length > 0;
	}

	return STAGE_REQUIRED_FIELDS[stage].every(
		(field) => selectors[field].length > 0,
	);
}
