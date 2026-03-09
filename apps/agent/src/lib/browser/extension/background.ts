declare const chrome: any;

const NATIVE_HOST_NAME = "ai.onescope.host";
const DEFAULT_TIMEOUT_MS = 60_000;

type NativeMessage =
	| {
			kind: "request";
			requestId: string;
			method: string;
			params?: any;
	  }
	| {
			kind: "response";
			requestId: string;
			ok: boolean;
			result?: unknown;
			error?: string;
	  }
	| {
			kind: "event";
			event: string;
			payload?: unknown;
	  };

const nativePort = chrome.runtime.connectNative(NATIVE_HOST_NAME);
const readyTabs = new Set<number>();

function sendEvent(event: string, payload?: unknown): void {
	nativePort.postMessage({ kind: "event", event, payload } satisfies NativeMessage);
}

function waitForTabUpdate(
	tabId: number,
	state: "domcontentloaded" | "load" | "networkidle",
	timeoutMs: number,
): Promise<void> {
	return new Promise((resolve, reject) => {
		let settled = false;
		let timeoutId: number | null = null;

		const finish = (error?: Error) => {
			if (settled) return;
			settled = true;
			if (timeoutId !== null) {
				clearTimeout(timeoutId);
			}
			chrome.tabs.onUpdated.removeListener(onUpdated);
			chrome.webNavigation.onDOMContentLoaded.removeListener(onDomContentLoaded);
			error ? reject(error) : resolve();
		};

		const onDomContentLoaded = (details: any) => {
			if (details.tabId !== tabId || details.frameId !== 0) return;
			if (state === "domcontentloaded") {
				finish();
			}
		};

		const onUpdated = (updatedTabId: number, changeInfo: any) => {
			if (updatedTabId !== tabId) return;
			if (changeInfo.status !== "complete") return;

			if (state === "load") {
				finish();
				return;
			}

			if (state === "networkidle") {
				setTimeout(() => finish(), 800);
			}
		};

		chrome.webNavigation.onDOMContentLoaded.addListener(onDomContentLoaded);
		chrome.tabs.onUpdated.addListener(onUpdated);

		chrome.tabs.get(tabId, (tab: any) => {
			if (chrome.runtime.lastError) {
				finish(new Error(chrome.runtime.lastError.message));
				return;
			}

			if (state === "networkidle" || state === "load") {
				if (tab?.status === "complete") {
					finish();
				}
			}
		});

		timeoutId = setTimeout(
			() => finish(new Error(`timed out waiting for ${state} on tab ${tabId}`)),
			timeoutMs,
		) as unknown as number;
	});
}

async function ensureContentScript(tabId: number, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		try {
			const response = await chrome.tabs.sendMessage(tabId, { method: "ping" });
			if (response?.ok) {
				readyTabs.add(tabId);
				return;
			}
		} catch {
			// Content script is still loading.
		}

		await new Promise((resolve) => setTimeout(resolve, 150));
	}

	throw new Error(`content script not ready for tab ${tabId}`);
}

async function sendToTab(
	tabId: number,
	method: string,
	params?: unknown,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<any> {
	await ensureContentScript(tabId, timeoutMs);
	const response = await chrome.tabs.sendMessage(tabId, { method, params });
	if (!response?.ok) {
		throw new Error(response?.error || `tab request failed: ${method}`);
	}
	return response.result;
}

async function createPage(): Promise<number> {
	const tab = await chrome.tabs.create({ url: "about:blank", active: true });
	if (!tab?.id) {
		throw new Error("chrome.tabs.create did not return a tab id");
	}
	return tab.id;
}

async function handleRequest(method: string, params: any): Promise<unknown> {
	switch (method) {
		case "createPage":
			return await createPage();
		case "closePage":
			if (typeof params?.tabId === "number") {
				await chrome.tabs.remove(params.tabId);
			}
			return true;
		case "goto":
			await chrome.tabs.update(params.tabId, { url: params.url });
			await waitForTabUpdate(
				params.tabId,
				params.waitUntil || "load",
				params.timeoutMs || DEFAULT_TIMEOUT_MS,
			);
			await ensureContentScript(params.tabId, params.timeoutMs || DEFAULT_TIMEOUT_MS);
			return true;
		case "getUrl": {
			const tab = await chrome.tabs.get(params.tabId);
			return tab?.url || "about:blank";
		}
		case "waitForLoadState":
			await waitForTabUpdate(
				params.tabId,
				params.state || "load",
				params.timeoutMs || DEFAULT_TIMEOUT_MS,
			);
			return true;
		case "waitForSelector":
			return await sendToTab(params.tabId, "waitForSelector", {
				selector: params.selector,
				timeoutMs: params.timeoutMs,
				state: params.state,
			});
		case "pageOp":
			return await sendToTab(params.tabId, "pageOp", params);
		case "locatorOp":
			return await sendToTab(params.tabId, "locatorOp", params);
		case "keyboardPress":
		case "keyboardType":
		case "mouseMove":
		case "mouseWheel":
		case "mouseClick":
			return await sendToTab(params.tabId, method, params);
		default:
			throw new Error(`unknown native method: ${method}`);
	}
}

chrome.runtime.onMessage.addListener((message: any, sender: any) => {
	if (message?.type === "onescope-content-ready" && sender?.tab?.id) {
		readyTabs.add(sender.tab.id);
	}
});

nativePort.onMessage.addListener(async (message: NativeMessage) => {
	if (message.kind !== "request") return;

	try {
		const result = await handleRequest(message.method, message.params || {});
		nativePort.postMessage({
			kind: "response",
			requestId: message.requestId,
			ok: true,
			result,
		} satisfies NativeMessage);
	} catch (error) {
		nativePort.postMessage({
			kind: "response",
			requestId: message.requestId,
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		} satisfies NativeMessage);
	}
});

nativePort.onDisconnect.addListener(() => {
	const message = chrome.runtime.lastError?.message || "native host disconnected";
	console.error(`[onescope-extension] ${message}`);
});

sendEvent("extension-ready");
