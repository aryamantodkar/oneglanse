import type { Locator } from "playwright";

/**
 * Extract content from visible Anthropic `.standard-markdown` blocks.
 *
 * Visibility is determined by walking up the DOM and checking parent computed
 * styles — blocks inside collapsed/hidden containers are excluded.
 *
 * @param el     - The root element locator containing the response
 * @param mode   - "text" returns innerText (for getText),
 *                 "html" returns innerHTML (for toMarkdown / Turndown)
 */
export async function extractAnthropicBlocks(
	el: Locator,
	mode: "text" | "html",
): Promise<string> {
	return el.evaluate(
		(root, { mode }) => {
			if (!(root instanceof HTMLElement)) return "";

			const blocks = Array.from(
				root.querySelectorAll<HTMLElement>(".standard-markdown"),
			);

			// Filter to only visible blocks (not inside collapsed/hidden containers)
			const visibleBlocks = blocks.filter((block) => {
				let parent = block.parentElement;
				while (parent && parent !== root) {
					const style = window.getComputedStyle(parent);

					// Skip if parent is hidden
					if (
						style.opacity === "0" ||
						style.height === "0px" ||
						style.display === "none" ||
						(parent.classList.contains("overflow-hidden") &&
							parent.style.height === "0px")
					) {
						return false;
					}

					parent = parent.parentElement;
				}
				return true;
			});

			if (mode === "html") {
				return visibleBlocks
					.map((b) => b.innerHTML?.trim() || "")
					.filter(Boolean)
					.join("<br><br>");
			}

			return visibleBlocks
				.map((b) => b.innerText?.trim() || b.textContent?.trim() || "")
				.filter(Boolean)
				.join("\n\n");
		},
		{ mode },
	);
}
