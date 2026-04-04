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
	if (token.includes("-") || token.includes("_")) {
		return true;
	}
	if (!/^[a-z]+$/.test(token)) {
		return false;
	}
	return token.length >= 4;
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
		if (field === "response") {
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
	return hashValue(
		JSON.stringify({
			stage: snapshot.stage,
			pageKey: snapshot.pageKey,
			editables: snapshot.editables.slice(0, 2).map((item) => ({
				selector: normalizeSelectorForState(item.selector),
				fingerprint: item.fingerprint,
			})),
			buttons: snapshot.buttons.slice(0, 8).map((item) => ({
				selector: normalizeSelectorForState(item.selector),
				ariaLabel: item.ariaLabel,
				text: item.text.slice(0, 60),
				fingerprint: item.fingerprint,
			})),
			content: snapshot.content.slice(0, 8).map((item) => ({
				selector: normalizeSelectorForState(item.selector),
				lengthBucket: Math.min(12, Math.floor(item.textLength / 250)),
				linkCount: item.linkCount,
				buttonCount: item.buttonCount,
				fingerprint: item.fingerprint,
			})),
			groups: snapshot.groups.slice(0, 6).map((item) => ({
				selector: normalizeSelectorForState(item.selector),
				groupCount: item.groupCount ?? 0,
				linkCount: item.linkCount,
				buttonCount: item.buttonCount,
				fingerprint: item.fingerprint,
			})),
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
