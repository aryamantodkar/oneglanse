import type {
	Browser,
	BrowserContext,
	ConsoleMessage,
	ElementEditableState,
	Locator,
	Page,
	PageViewportSize,
	Worker,
} from "./runtimeTypes.js";
import { runPageDomOp } from "./domOps.js";
import type {
	BrowserContext as PlaywrightBrowserContext,
	Locator as PlaywrightLocator,
	Page as PlaywrightPage,
	Worker as PlaywrightWorker,
} from "playwright-core";

class PlaywrightWorkerCompat implements Worker {
	constructor(private readonly worker: PlaywrightWorker) {}

	async evaluate(script: string): Promise<unknown> {
		return await this.worker.evaluate(script);
	}
}

export class PlaywrightLocatorCompat implements Locator {
	constructor(private readonly locator: PlaywrightLocator) {}

	private wrap(next: PlaywrightLocator): PlaywrightLocatorCompat {
		return new PlaywrightLocatorCompat(next);
	}

	count(): Promise<number> {
		return this.locator.count();
	}

	nth(index: number): Locator {
		return this.wrap(this.locator.nth(index));
	}

	first(): Locator {
		return this.wrap(this.locator.first());
	}

	last(): Locator {
		return this.wrap(this.locator.last());
	}

	filter(options: { hasText: string | RegExp }): Locator {
		return this.wrap(this.locator.filter({ hasText: options.hasText }));
	}

	getByText(text: string | RegExp): Locator {
		return this.wrap(this.locator.getByText(text));
	}

	isVisible(options?: { timeout?: number }): Promise<boolean> {
		return this.locator.isVisible(options);
	}

	isEnabled(): Promise<boolean> {
		return this.locator.isEnabled();
	}

	focus(): Promise<void> {
		return this.locator.focus();
	}

	boundingBox(): Promise<{
		x: number;
		y: number;
		width: number;
		height: number;
	} | null> {
		return this.locator.boundingBox();
	}

	scrollIntoViewIfNeeded(): Promise<void> {
		return this.locator.scrollIntoViewIfNeeded();
	}

	click(options?: {
		timeout?: number;
		delay?: number;
		force?: boolean;
	}): Promise<void> {
		return this.locator.click(options);
	}

	press(key: string, options?: { delay?: number }): Promise<void> {
		return this.locator.press(key, options);
	}

	waitFor(options?: { timeout?: number; state?: "visible" | "hidden" }): Promise<void> {
		return this.locator.waitFor({
			timeout: options?.timeout,
			state: options?.state,
		});
	}

	async readInputValue(): Promise<string> {
		return await this.locator.evaluate((element) => {
			if (
				element instanceof HTMLInputElement ||
				element instanceof HTMLTextAreaElement
			) {
				return element.value.trim();
			}
			if (element instanceof HTMLElement) {
				return (element.innerText || element.textContent || "").trim();
			}
			return "";
		});
	}

	async setInputValue(value: string): Promise<void> {
		await this.locator.evaluate((element, nextValue) => {
			if (
				element instanceof HTMLInputElement ||
				element instanceof HTMLTextAreaElement
			) {
				const proto = Object.getPrototypeOf(element);
				const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
				if (descriptor?.set) {
					descriptor.set.call(element, nextValue);
				} else {
					element.value = nextValue;
				}
				element.dispatchEvent(new Event("input", { bubbles: true }));
				element.dispatchEvent(new Event("change", { bubbles: true }));
				return;
			}

			if (element instanceof HTMLElement) {
				element.focus();
				element.innerText = nextValue;
				element.dispatchEvent(new Event("input", { bubbles: true }));
				element.dispatchEvent(new Event("change", { bubbles: true }));
			}
		}, value);
	}

	async getEditableState(): Promise<ElementEditableState> {
		return await this.locator.evaluate((element) => {
			if (!(element instanceof HTMLElement)) {
				return { connected: false, visible: false, editable: false };
			}

			const style = window.getComputedStyle(element);
			const rect = element.getBoundingClientRect();
			const visible =
				element.isConnected &&
				style.display !== "none" &&
				style.visibility !== "hidden" &&
				style.opacity !== "0" &&
				rect.width > 0 &&
				rect.height > 0;

			return {
				connected: element.isConnected,
				visible,
				editable:
					element.tagName === "TEXTAREA" ||
					element.tagName === "INPUT" ||
					element.getAttribute("contenteditable") === "true",
			};
		});
	}

	async dispatchClick(): Promise<void> {
		await this.locator.evaluate((element) => {
			if (!(element instanceof HTMLElement)) return;
			element.dispatchEvent(
				new MouseEvent("click", {
					bubbles: true,
					cancelable: true,
					composed: true,
					view: window,
				}),
			);
		});
	}
}

export class PlaywrightBrowserContextCompat implements BrowserContext {
	private readonly pageMap = new WeakMap<PlaywrightPage, PlaywrightPageCompat>();
	private initialPage: PlaywrightPage | null;

	constructor(private readonly context: PlaywrightBrowserContext) {
		const existingPages = this.context.pages();
		this.initialPage =
			existingPages.length === 1 && existingPages[0]?.url() === "about:blank"
				? existingPages[0]
				: null;
	}

	private wrapPage(page: PlaywrightPage): PlaywrightPageCompat {
		const existing = this.pageMap.get(page);
		if (existing) return existing;
		const wrapped = new PlaywrightPageCompat(page, this);
		this.pageMap.set(page, wrapped);
		return wrapped;
	}

	getRawContext(): PlaywrightBrowserContext {
		return this.context;
	}

	getBrowser(): Browser {
		const browser = this.context.browser();
		if (browser) return browser as unknown as Browser;
		return {
			version: () => "Camoufox",
			close: () => this.context.close(),
		};
	}

	async newPage(): Promise<Page> {
		if (this.initialPage) {
			const page = this.initialPage;
			this.initialPage = null;
			return this.wrapPage(page);
		}

		return this.wrapPage(await this.context.newPage());
	}

	async close(): Promise<void> {
		await this.context.close();
	}

	async storageState(options?: { path?: string }): Promise<void> {
		await this.context.storageState(options);
	}

	async addInitScript(script: string): Promise<void> {
		await this.context.addInitScript(script);
	}

	on(event: "page", listener: (page: Page) => void): void {
		this.context.on(event, (page) => {
			listener(this.wrapPage(page));
		});
	}
}

export class PlaywrightPageCompat implements Page {
	readonly mouse;
	readonly keyboard;

	constructor(
		private readonly page: PlaywrightPage,
		private readonly owner: PlaywrightBrowserContextCompat,
	) {
		this.mouse = this.page.mouse;
		this.keyboard = this.page.keyboard;
	}

	getRawPage(): PlaywrightPage {
		return this.page;
	}

	async goto(
		url: string,
		options?: {
			waitUntil?: "domcontentloaded" | "load" | "networkidle";
			timeout?: number;
			referer?: string;
		},
	): Promise<void> {
		await this.page.goto(url, options);
	}

	url(): string {
		return this.page.url();
	}

	async getUrl(): Promise<string> {
		return this.page.url();
	}

	waitForTimeout(ms: number): Promise<void> {
		return this.page.waitForTimeout(ms);
	}

	waitForLoadState(
		state?: "domcontentloaded" | "load" | "networkidle",
		options?: { timeout?: number },
	): Promise<void> {
		return this.page.waitForLoadState(state, options);
	}

	async waitForSelector(
		selector: string,
		options?: {
			timeout?: number;
			state?: "attached" | "visible" | "hidden";
		},
	): Promise<void> {
		await this.page.waitForSelector(selector, options ?? {});
	}

	locator(selector: string): Locator {
		return new PlaywrightLocatorCompat(this.page.locator(selector));
	}

	close(): Promise<void> {
		return this.page.close();
	}

	setDefaultTimeout(ms: number): void {
		this.page.setDefaultTimeout(ms);
	}

	setDefaultNavigationTimeout(ms: number): void {
		this.page.setDefaultNavigationTimeout(ms);
	}

	on(
		event: "console" | "worker",
		listener: ((message: ConsoleMessage) => void) | ((worker: Worker) => void),
	): void {
		if (event === "console") {
			this.page.on(event, listener as (message: ConsoleMessage) => void);
			return;
		}

		this.page.on(event, (worker) => {
			(listener as (worker: Worker) => void)(
				new PlaywrightWorkerCompat(worker),
			);
		});
	}

	context(): BrowserContext {
		return this.owner;
	}

	viewportSize(): PageViewportSize | null {
		return this.page.viewportSize();
	}

	async runDomOp<T>(operation: string, params?: unknown): Promise<T> {
		return await runPageDomOp<T>(
			this.page,
			operation,
			(params as Record<string, unknown> | undefined) ?? {},
		);
	}

	async ping(): Promise<boolean> {
		try {
			await Promise.race([
				this.page.evaluate(() => true),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error("page ping timeout")), 5_000),
				),
			]);
			return true;
		} catch {
			return false;
		}
	}
}
