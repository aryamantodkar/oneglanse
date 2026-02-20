import { marked } from "marked";

marked.setOptions({
	gfm: true,
	breaks: true,
});

export function formatMarkdown(text: string): string {
	if (!text) return "No response available";
	return marked.parse(text) as string;
}
