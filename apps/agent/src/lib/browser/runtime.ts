import { EventEmitter } from "node:events";
import type {
	Browser,
	BrowserContext,
	ClickOptions,
	ElementEditableState,
	GotoOptions,
	Keyboard,
	KeyboardPressOptions,
	LoadState,
	Locator,
	LocatorFilterOptions,
	Mouse,
	MouseMoveOptions,
	Page,
	PageViewportSize,
	WaitForOptions,
	WaitForSelectorOptions,
	Worker,
} from "./runtimeTypes.js";
import { NativeBridge } from "./native/bridge.js";

type SerializedPattern =
	| { kind: "string"; value: string }
	| { kind: "regex"; source: string; flags: string };

type LocatorStep =
	| { kind: "selector"; selector: string }
	| { kind: "filterText"; pattern: SerializedPattern }
	| { kind: "getByText"; pattern: SerializedPattern }
	| { kind: "index"; index: number };

type SerializedLocator = {
	steps: LocatorStep[];
};

function serializePattern(value: string | RegExp): SerializedPattern {
	if (typeof value === "string") {
		return { kind: "string", value };
	}

	return {
		kind: "regex",
		source: value.source,
		flags: value.flags,
	};
}

class NativeMouse implements Mouse {
	constructor(private readonly page: NativePage) {}

	async move(x: number, y: number, _options?: MouseMoveOptions): Promise<void> {
		await this.page.request("mouseMove", { x, y });
	}

	async wheel(deltaX: number, deltaY: number): Promise<void> {
		await this.page.request("mouseWheel", { deltaX, deltaY });
	}

	async click(x: number, y: number): Promise<void> {
		await this.page.request("mouseClick", { x, y });
	}
}

class NativeKeyboard implements Keyboard {
	private readonly modifiers = new Set<string>();

	constructor(private readonly page: NativePage) {}

	async press(key: string, _options?: KeyboardPressOptions): Promise<void> {
		const normalized =
			key === "Enter" && this.modifiers.has("Shift") ? "Shift+Enter" : key;
		await this.page.request("keyboardPress", { key: normalized });
	}

	async type(text: string): Promise<void> {
		await this.page.request("keyboardType", { text });
	}

	async down(key: string): Promise<void> {
		this.modifiers.add(key);
	}

	async up(key: string): Promise<void> {
		this.modifiers.delete(key);
	}
}

export class NativeLocator implements Locator {
	constructor(
		private readonly page: NativePage,
		private readonly locator: SerializedLocator,
	) {}

	private cloneWith(step: LocatorStep): NativeLocator {
		return new NativeLocator(this.page, {
			steps: [...this.locator.steps, step],
		});
	}

	private async request<T>(
		operation: string,
		params: Record<string, unknown> = {},
	): Promise<T> {
		return await this.page.request<T>("locatorOp", {
			locator: this.locator,
			operation,
			...params,
		});
	}

	count(): Promise<number> {
		return this.request<number>("count");
	}

	nth(index: number): Locator {
		return this.cloneWith({ kind: "index", index });
	}

	first(): Locator {
		return this.nth(0);
	}

	last(): Locator {
		return this.nth(-1);
	}

	filter(options: LocatorFilterOptions): Locator {
		return this.cloneWith({
			kind: "filterText",
			pattern: serializePattern(options.hasText),
		});
	}

	getByText(text: string | RegExp): Locator {
		return this.cloneWith({
			kind: "getByText",
			pattern: serializePattern(text),
		});
	}

	async isVisible(options?: { timeout?: number }): Promise<boolean> {
		const timeoutMs = options?.timeout ?? 0;
		const deadline = Date.now() + timeoutMs;

		while (true) {
			const visible = await this.request<boolean>("isVisible");
			if (visible) return true;
			if (Date.now() >= deadline) return false;
			await this.page.waitForTimeout(100);
		}
	}

	isEnabled(): Promise<boolean> {
		return this.request<boolean>("isEnabled");
	}

	async focus(): Promise<void> {
		await this.request("focus");
	}

	boundingBox(): Promise<{
		x: number;
		y: number;
		width: number;
		height: number;
	} | null> {
		return this.request("boundingBox");
	}

	async scrollIntoViewIfNeeded(): Promise<void> {
		await this.request("scrollIntoViewIfNeeded");
	}

	async click(_options?: ClickOptions): Promise<void> {
		await this.request("click");
	}

	async waitFor(options?: WaitForOptions): Promise<void> {
		await this.request("waitFor", {
			state: options?.state || "visible",
			timeoutMs: options?.timeout,
		});
	}

	readInputValue(): Promise<string> {
		return this.request<string>("readInputValue");
	}

	async setInputValue(value: string): Promise<void> {
		await this.request("setInputValue", { value });
	}

	getEditableState(): Promise<ElementEditableState> {
		return this.request<ElementEditableState>("getEditableState");
	}

	async dispatchClick(): Promise<void> {
		await this.request("dispatchClick");
	}
}

export class NativePage implements Page {
	readonly mouse: Mouse;
	readonly keyboard: Keyboard;
	private defaultTimeoutMs = 30_000;
	private defaultNavigationTimeoutMs = 60_000;
	private currentUrl = "about:blank";

	constructor(
		private readonly bridge: NativeBridge,
		private readonly owner: NativeBrowserContext,
		private readonly tabId: number,
		private readonly viewport: PageViewportSize,
	) {
		this.mouse = new NativeMouse(this);
		this.keyboard = new NativeKeyboard(this);
	}

	getTabId(): number {
		return this.tabId;
	}

	async request<T>(
		method: string,
		params: Record<string, unknown> = {},
		timeoutMs?: number,
	): Promise<T> {
		return await this.bridge.request<T>(
			method,
			{
				tabId: this.tabId,
				...params,
			},
			timeoutMs,
		);
	}

	async goto(url: string, options?: GotoOptions): Promise<void> {
		await this.request(
			"goto",
			{
				url,
				waitUntil: options?.waitUntil || "load",
				timeoutMs: options?.timeout ?? this.defaultNavigationTimeoutMs,
			},
			options?.timeout ?? this.defaultNavigationTimeoutMs,
		);
		this.currentUrl = await this.getUrl();
	}

	url(): string {
		return this.currentUrl;
	}

	async getUrl(): Promise<string> {
		this.currentUrl = await this.request<string>("getUrl");
		return this.currentUrl;
	}

	async waitForTimeout(ms: number): Promise<void> {
		await new Promise((resolve) => setTimeout(resolve, ms));
	}

	async waitForLoadState(
		state: LoadState = "load",
		options?: { timeout?: number },
	): Promise<void> {
		await this.request(
			"waitForLoadState",
			{
				state,
				timeoutMs: options?.timeout ?? this.defaultNavigationTimeoutMs,
			},
			options?.timeout ?? this.defaultNavigationTimeoutMs,
		);
		await this.getUrl().catch(() => {});
	}

	async waitForSelector(
		selector: string,
		options?: WaitForSelectorOptions,
	): Promise<void> {
		await this.request(
			"waitForSelector",
			{
				selector,
				timeoutMs: options?.timeout ?? this.defaultTimeoutMs,
				state: options?.state || "visible",
			},
			options?.timeout ?? this.defaultTimeoutMs,
		);
	}

	locator(selector: string): Locator {
		return new NativeLocator(this, {
			steps: [{ kind: "selector", selector }],
		});
	}

	async close(): Promise<void> {
		await this.request("closePage");
	}

	setDefaultTimeout(ms: number): void {
		this.defaultTimeoutMs = ms;
	}

	setDefaultNavigationTimeout(ms: number): void {
		this.defaultNavigationTimeoutMs = ms;
	}

	on(event: "console" | "worker", _listener: ((message: any) => void) | ((worker: Worker) => void)): void {
		// No-op. The extension transport does not expose page console or worker hooks.
	}

	context(): BrowserContext {
		return this.owner;
	}

	viewportSize(): PageViewportSize | null {
		return this.viewport;
	}

	async runDomOp<T>(operation: string, params?: unknown): Promise<T> {
		return await this.request<T>(
			"pageOp",
			{
				operation,
				...(params && typeof params === "object"
					? (params as Record<string, unknown>)
					: { value: params }),
			},
			this.defaultTimeoutMs,
		);
	}

	async ping(): Promise<boolean> {
		return await this.request<boolean>("pageOp", { operation: "ping" }, 5_000);
	}
}

export class NativeBrowserContext implements BrowserContext {
	private readonly events = new EventEmitter();

	constructor(
		private readonly bridge: NativeBridge,
		private readonly viewport: PageViewportSize,
	) {}

	async newPage(): Promise<Page> {
		const tabId = await this.bridge.request<number>("createPage");
		const page = new NativePage(this.bridge, this, tabId, this.viewport);
		this.events.emit("page", page);
		return page;
	}

	async close(): Promise<void> {
		this.events.removeAllListeners();
	}

	async storageState(_options?: { path?: string }): Promise<void> {
		// Real Chrome profiles persist directly via user-data-dir.
	}

	async addInitScript(_script: string): Promise<void> {
		// Intentionally unsupported. The extension architecture removes the init-script path.
	}

	on(event: "page", listener: (page: Page) => void): void {
		this.events.on(event, listener);
	}
}

export class NativeBrowser implements Browser {
	constructor(
		private readonly versionString: string,
		private readonly closeFn: () => Promise<void>,
	) {}

	version(): string {
		return this.versionString;
	}

	async close(): Promise<void> {
		await this.closeFn();
	}
}
