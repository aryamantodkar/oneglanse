export type LoadState = "domcontentloaded" | "load" | "networkidle";

export type PageViewportSize = {
	width: number;
	height: number;
};

export type BoundingBox = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type GotoOptions = {
	waitUntil?: LoadState;
	timeout?: number;
	referer?: string;
};

export type WaitForSelectorOptions = {
	timeout?: number;
	state?: "attached" | "visible" | "hidden";
};

export type WaitForOptions = {
	timeout?: number;
	state?: "visible" | "hidden";
};

export type LocatorFilterOptions = {
	hasText: string | RegExp;
};

export type ClickOptions = {
	timeout?: number;
	delay?: number;
	force?: boolean;
};

export type KeyboardPressOptions = {
	delay?: number;
};

export type MouseMoveOptions = {
	steps?: number;
};

export type ElementEditableState = {
	connected: boolean;
	visible: boolean;
	editable: boolean;
};

export interface ConsoleMessage {
	text(): string;
}

export interface Worker {
	evaluate(script: string): Promise<unknown>;
}

export interface Mouse {
	move(x: number, y: number, options?: MouseMoveOptions): Promise<void>;
	wheel(deltaX: number, deltaY: number): Promise<void>;
	click(x: number, y: number): Promise<void>;
}

export interface Keyboard {
	press(key: string, options?: KeyboardPressOptions): Promise<void>;
	type(text: string): Promise<void>;
	down(key: string): Promise<void>;
	up(key: string): Promise<void>;
}

export interface Locator {
	count(): Promise<number>;
	nth(index: number): Locator;
	first(): Locator;
	last(): Locator;
	filter(options: LocatorFilterOptions): Locator;
	getByText(text: string | RegExp): Locator;
	isVisible(options?: { timeout?: number }): Promise<boolean>;
	isEnabled(): Promise<boolean>;
	focus(): Promise<void>;
	boundingBox(): Promise<BoundingBox | null>;
	scrollIntoViewIfNeeded(): Promise<void>;
	click(options?: ClickOptions): Promise<void>;
	press(key: string, options?: KeyboardPressOptions): Promise<void>;
	waitFor(options?: WaitForOptions): Promise<void>;
	readInputValue(): Promise<string>;
	setInputValue(value: string): Promise<void>;
	getEditableState(): Promise<ElementEditableState>;
	dispatchClick(): Promise<void>;
}

export interface Page {
	goto(url: string, options?: GotoOptions): Promise<void>;
	url(): string;
	getUrl(): Promise<string>;
	waitForTimeout(ms: number): Promise<void>;
	waitForLoadState(
		state?: LoadState,
		options?: { timeout?: number },
	): Promise<void>;
	waitForSelector(
		selector: string,
		options?: WaitForSelectorOptions,
	): Promise<void>;
	locator(selector: string): Locator;
	close(): Promise<void>;
	setDefaultTimeout(ms: number): void;
	setDefaultNavigationTimeout(ms: number): void;
	on(event: "console", listener: (message: ConsoleMessage) => void): void;
	on(event: "worker", listener: (worker: Worker) => void): void;
	context(): BrowserContext;
	viewportSize(): PageViewportSize | null;
	runDomOp<T>(operation: string, params?: unknown): Promise<T>;
	ping(): Promise<boolean>;
	mouse: Mouse;
	keyboard: Keyboard;
}

export type StorageStateOptions = {
	path?: string;
};

export type BrowserContextOptions = {
	storageState?:
		| string
		| {
				cookies?: unknown[];
				origins?: unknown[];
		  };
	viewport?: PageViewportSize;
	locale?: string;
	timezoneId?: string;
	userAgent?: string;
	extraHTTPHeaders?: Record<string, string>;
};

export interface BrowserContext {
	newPage(): Promise<Page>;
	close(): Promise<void>;
	storageState(options?: StorageStateOptions): Promise<void>;
	addInitScript(script: string): Promise<void>;
	on(event: "page", listener: (page: Page) => void): void;
}

export interface Browser {
	version(): string;
	close(): Promise<void>;
}
