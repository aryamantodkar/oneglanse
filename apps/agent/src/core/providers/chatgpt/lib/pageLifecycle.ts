import type { ProviderConfig } from "../../types.js";
import { resetProviderPage } from "../../_shared/resetProviderPage.js";
import { dismissChatgptAuthModal } from "./dismissAuthModal.js";

export const CHATGPT_URL = "https://chatgpt.com/";

export async function resetChatgptPage(
	page: Parameters<ProviderConfig["waitForResponse"]>[0],
): Promise<void> {
	await resetProviderPage(page, "chatgpt", CHATGPT_URL);
	await dismissChatgptAuthModal(page, { waitForAppearanceMs: 1000 });
}
