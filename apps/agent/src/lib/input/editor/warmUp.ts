import type { Page } from "playwright";
import { logger } from "../../utils/logger.js";
import { findActiveEditor } from "./findEditor.js";

export async function warmUpEditor(page: Page) {
	logger.debug("🔥 Warming up prompt editor...");

	const editor = await findActiveEditor(page);

	await editor.click({ force: true });
	await page.waitForTimeout(300);

	const isMac = process.platform === "darwin";
	const modKey = isMac ? "Meta" : "Control";

	await editor.press(`${modKey}+A`);
	await editor.press("Backspace");

	await page.waitForTimeout(200);

	logger.debug("✅ Warm-up successful");
}
