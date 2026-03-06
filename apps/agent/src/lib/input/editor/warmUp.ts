import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { clearEditorInput } from "./clearInput.js";
import { waitForEditorReady } from "./waitForReady.js";

export async function warmUpEditor(
	page: Page,
	provider: Provider,
): Promise<void> {
	const editor = await waitForEditorReady(page, provider);
	await clearEditorInput(page, editor, { waitAfterMs: 200 });
}
