import type { Provider } from "@oneglanse/types";
import type { Page } from "playwright";
import { readResponseProbe } from "./responseMonitor.js";

export async function getText(
	page: Page,
	_provider: Provider,
): Promise<string> {
	return (await readResponseProbe(page)).text;
}
