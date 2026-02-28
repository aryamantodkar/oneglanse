import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

const SAFE_LINK_PROTOCOL_RE = /^(https?:|mailto:|\/|#)/i;

function sanitizeHref(href: string | null | undefined): string {
	const value = (href ?? "").trim();
	if (!value) return "#";
	return SAFE_LINK_PROTOCOL_RE.test(value) ? value : "#";
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
	return escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const renderer = new marked.Renderer();

// Drop any raw HTML blocks embedded in markdown input.
renderer.html = () => "";

// Enforce safe link protocols and safe anchor attributes.
renderer.link = ({ href, title, tokens }) => {
	const safeHref = sanitizeHref(href);
	const text = escapeHtml(tokens.map((t) => t.raw).join(""));
	const safeTitle = title ? ` title="${escapeAttribute(title)}"` : "";
	return `<a href="${escapeAttribute(safeHref)}" target="_blank" rel="noopener noreferrer"${safeTitle}>${text}</a>`;
};

marked.setOptions({
	gfm: true,
	breaks: true,
	renderer,
});

export function formatMarkdown(text: string): string {
	if (!text) return "No response available";
	const rendered = marked.parse(text) as string;
	return sanitizeHtml(rendered, {
		allowedTags: [
			"p",
			"br",
			"strong",
			"em",
			"blockquote",
			"code",
			"pre",
			"ul",
			"ol",
			"li",
			"h1",
			"h2",
			"h3",
			"h4",
			"h5",
			"h6",
			"hr",
			"a",
		],
		allowedAttributes: {
			a: ["href", "title", "target", "rel"],
		},
		allowedSchemes: ["http", "https", "mailto"],
		disallowedTagsMode: "discard",
		transformTags: {
			a: (_tagName, attrs) => {
				const safeHref = sanitizeHref(attrs.href);
				return {
					tagName: "a",
					attribs: {
						href: safeHref,
						target: "_blank",
						rel: "noopener noreferrer",
						...(attrs.title ? { title: attrs.title } : {}),
					},
				};
			},
		},
	});
}
