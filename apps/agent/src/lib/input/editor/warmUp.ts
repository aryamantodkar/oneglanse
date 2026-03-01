import type { Page } from "playwright";
import { findActiveEditor } from "./findEditor.js";
import { clearEditorInput } from "./clearInput.js";

export async function warmUpEditor(page: Page): Promise<void> {
	const editor = await findActiveEditor(page);
	await clearEditorInput(page, editor, { waitAfterMs: 200 });
}
