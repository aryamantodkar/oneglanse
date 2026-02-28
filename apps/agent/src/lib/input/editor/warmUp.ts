import type { Page } from "playwright";
import { logger } from "@oneglanse/utils";
import { findActiveEditor } from "./findEditor.js";
import { clearEditorInput } from "./clearInput.js";

export async function warmUpEditor(page: Page): Promise<void> {
	logger.debug("🔥 Warming up prompt editor...");

	const editor = await findActiveEditor(page);
	await clearEditorInput(page, editor, { waitAfterMs: 200 });

	logger.debug("✅ Warm-up successful");
}
