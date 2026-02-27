import { marked } from "marked";

const SAFE_LINK_PROTOCOL_RE = /^(https?:|mailto:|\/|#)/i;

function sanitizeHref(href: string | null | undefined): string {
	const value = (href ?? "").trim();
	if (!value) return "#";
	return SAFE_LINK_PROTOCOL_RE.test(value) ? value : "#";
}

const renderer = new marked.Renderer();

// Drop any raw HTML blocks embedded in markdown input.
renderer.html = () => "";

// Enforce safe link protocols and safe anchor attributes.
renderer.link = ({ href, title, tokens }) => {
	const safeHref = sanitizeHref(href);
	const text = tokens.map((t) => t.raw).join("");
	const safeTitle = title ? ` title="${title.replace(/"/g, "&quot;")}"` : "";
	return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer"${safeTitle}>${text}</a>`;
};

marked.setOptions({
	gfm: true,
	breaks: true,
	renderer,
});

export function formatMarkdown(text: string): string {
	if (!text) return "No response available";
	return marked.parse(text) as string;
}
