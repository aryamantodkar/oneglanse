import TurndownService from "turndown";

const turndown = new TurndownService({
	headingStyle: "atx",
	codeBlockStyle: "fenced",
	bulletListMarker: "-",
	br: "\n",
});

// Ensure paragraphs have proper spacing
turndown.addRule("paragraph", {
	filter: "p",
	replacement(content) {
		return `\n\n${content}\n\n`;
	},
});

// Preserve div blocks as paragraphs
turndown.addRule("div", {
	filter: "div",
	replacement(content) {
		return `\n\n${content.trim()}\n\n`;
	},
});

// Headings with proper spacing
turndown.addRule("heading", {
	filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
	replacement(content, node) {
		const level = Number(node.nodeName.charAt(1));
		return `\n\n${"#".repeat(level)} ${content}\n\n`;
	},
});

// Lists with proper spacing
turndown.addRule("list", {
	filter: ["ul", "ol"],
	replacement(content, node) {
		const parent = node.parentNode;
		// Don't add extra spacing for nested lists
		if (
			parent &&
			(parent.nodeName === "LI" ||
				parent.nodeName === "UL" ||
				parent.nodeName === "OL")
		) {
			return `\n${content}`;
		}
		return `\n\n${content}\n\n`;
	},
});

turndown.addRule("table", {
	filter: "table",
	replacement(_content, node) {
		const table = node as HTMLTableElement;
		const rows = Array.from(table.querySelectorAll("tr"));
		if (rows.length === 0) return "";

		const result: string[] = [];

		for (let i = 0; i < rows.length; i++) {
			const cells = Array.from(rows[i]!.querySelectorAll("th, td"));
			const line = cells.map((c) => (c.textContent ?? "").trim()).join(" | ");
			result.push(`| ${line} |`);

			if (i === 0) {
				result.push(`| ${cells.map(() => "---").join(" | ")} |`);
			}
		}

		return `\n\n${result.join("\n")}\n\n`;
	},
});

// Strip all visual media — only plain text responses are needed
turndown.addRule("image", { filter: "img", replacement: () => "" });
turndown.addRule("figure", { filter: "figure", replacement: () => "" });
turndown.addRule("picture", { filter: "picture", replacement: () => "" });
turndown.addRule("video", { filter: "video", replacement: () => "" });
turndown.addRule("iframe", { filter: "iframe", replacement: () => "" });
turndown.addRule("carousel", {
	filter(node) {
		const el = node as HTMLElement;
		const cn = el.className || "";
		return (
			el.nodeName === "DIV" &&
			(cn.includes("carousel") ||
				cn.includes("gallery") ||
				cn.includes("slider") ||
				cn.includes("swiper"))
		);
	},
	replacement: () => "",
});

export { turndown };
