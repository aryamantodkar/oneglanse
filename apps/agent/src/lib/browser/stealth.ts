import { release } from "node:os";
import type { BrowserContextOptions } from "playwright";
import { env } from "../../env.js";

type Size = {
	width: number;
	height: number;
};

export type SessionProfile = {
	viewport: Size;
	screen: Size & {
		availWidth: number;
		availHeight: number;
	};
	outerDelta: Size;
	webgl: {
		vendor: string;
		renderer: string;
	};
	deviceMemory: number;
	hardwareConcurrency: number;
	noiseSeed: number;
};

export type BrowserSessionSettings = {
	locale: string;
	acceptLanguage: string;
	timezoneId?: string;
	geolocation?: {
		latitude: number;
		longitude: number;
		accuracy?: number;
	};
};

type WeightedItem<T> = {
	value: T;
	weight: number;
};

type BrowserBrand = {
	brand: string;
	version: string;
};

type BrowserIdentity = {
	fullVersion: string;
	userAgent: string;
	brands: BrowserBrand[];
	fullVersionList: BrowserBrand[];
	fullVersionListHeader: string;
	platform: string;
	platformNavigator: string;
	platformVersion: string;
	architecture: string;
	bitness: string;
	model: string;
	mobile: boolean;
	wow64: boolean;
	secChUa: string;
};

type HostPlatform = "linux" | "windows" | "macos";

const VIEWPORTS: WeightedItem<Size>[] = [
	{ value: { width: 1920, height: 1080 }, weight: 45 },
	{ value: { width: 1366, height: 768 }, weight: 20 },
	{ value: { width: 1536, height: 864 }, weight: 10 },
	{ value: { width: 1440, height: 900 }, weight: 8 },
	{ value: { width: 1680, height: 1050 }, weight: 5 },
	{ value: { width: 2560, height: 1440 }, weight: 5 },
	{ value: { width: 1280, height: 720 }, weight: 4 },
	{ value: { width: 1600, height: 900 }, weight: 3 },
];

const WEBGL_PROFILES: Record<
	HostPlatform,
	WeightedItem<SessionProfile["webgl"]>[]
> = {
	linux: [
		{
			value: {
				vendor: "Google Inc. (Intel)",
				renderer:
					"ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)",
			},
			weight: 30,
		},
		{
			value: {
				vendor: "Google Inc. (Intel)",
				renderer:
					"ANGLE (Intel, Mesa Intel(R) UHD Graphics 770 (ADL-S GT1), OpenGL 4.6)",
			},
			weight: 25,
		},
		{
			value: {
				vendor: "Google Inc. (Intel)",
				renderer:
					"ANGLE (Intel, Mesa Intel(R) HD Graphics 530 (SKL GT2), OpenGL 4.5)",
			},
			weight: 15,
		},
		{
			value: {
				vendor: "Google Inc. (NVIDIA)",
				renderer:
					"ANGLE (NVIDIA, NVIDIA GeForce GTX 1650/PCIe/SSE2, OpenGL 4.6.0)",
			},
			weight: 20,
		},
		{
			value: {
				vendor: "Google Inc. (AMD)",
				renderer: "ANGLE (AMD, Mesa AMD Radeon RX 580, OpenGL 4.6)",
			},
			weight: 10,
		},
	],
	windows: [
		{
			value: {
				vendor: "Google Inc. (Intel)",
				renderer:
					"ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)",
			},
			weight: 35,
		},
		{
			value: {
				vendor: "Google Inc. (Intel)",
				renderer:
					"ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)",
			},
			weight: 25,
		},
		{
			value: {
				vendor: "Google Inc. (NVIDIA)",
				renderer:
					"ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)",
			},
			weight: 25,
		},
		{
			value: {
				vendor: "Google Inc. (AMD)",
				renderer:
					"ANGLE (AMD, AMD Radeon RX 580 Series Direct3D11 vs_5_0 ps_5_0, D3D11)",
			},
			weight: 15,
		},
	],
	macos: [
		{
			value: {
				vendor: "Google Inc. (Apple)",
				renderer:
					"ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)",
			},
			weight: 35,
		},
		{
			value: {
				vendor: "Google Inc. (Apple)",
				renderer:
					"ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)",
			},
			weight: 25,
		},
		{
			value: {
				vendor: "Google Inc. (Intel)",
				renderer:
					"ANGLE (Intel, Intel(R) Iris Plus Graphics OpenGL Engine, OpenGL 4.1)",
			},
			weight: 25,
		},
		{
			value: {
				vendor: "Google Inc. (AMD)",
				renderer: "ANGLE (AMD, AMD Radeon Pro 5500M OpenGL Engine, OpenGL 4.1)",
			},
			weight: 15,
		},
	],
};

const DEVICE_MEMORY: WeightedItem<number>[] = [
	{ value: 4, weight: 20 },
	{ value: 8, weight: 60 },
	{ value: 16, weight: 20 },
];

const HARDWARE_CONCURRENCY: WeightedItem<number>[] = [
	{ value: 4, weight: 20 },
	{ value: 8, weight: 45 },
	{ value: 12, weight: 15 },
	{ value: 16, weight: 20 },
];

const DEFAULT_LOCALE = env.BROWSER_LOCALE?.trim() || "en-US";
const DEFAULT_ACCEPT_LANGUAGE =
	env.BROWSER_ACCEPT_LANGUAGE?.trim() || `${DEFAULT_LOCALE},en;q=0.9`;
const DEFAULT_TIMEZONE = env.BROWSER_TIMEZONE?.trim() || "America/New_York";
const DEFAULT_GEOLOCATION = {
	latitude: 40.7128,
	longitude: -74.006,
	accuracy: 25,
} as const;
const DEFAULT_BROWSER_VERSION = "143.0.7499.4";
const UA_GREASE_BRANDS = ["Not A;Brand", "Not)A;Brand", "Not/A)Brand"] as const;
const HOST_PLATFORM: HostPlatform =
	process.platform === "win32"
		? "windows"
		: process.platform === "darwin"
			? "macos"
			: "linux";
const FONT_FAMILIES_BY_PLATFORM: Record<HostPlatform, string[]> = {
	linux: [
		"Arial",
		"Caladea",
		"Carlito",
		"Courier New",
		"DejaVu Sans",
		"DejaVu Sans Mono",
		"DejaVu Serif",
		"FreeMono",
		"FreeSans",
		"FreeSerif",
		"Georgia",
		"Liberation Mono",
		"Liberation Sans",
		"Liberation Serif",
		"Noto Color Emoji",
		"Noto Sans",
		"Noto Serif",
		"Roboto",
		"Times New Roman",
		"Trebuchet MS",
		"Ubuntu",
		"Verdana",
	],
	windows: [
		"Arial",
		"Arial Black",
		"Calibri",
		"Cambria",
		"Candara",
		"Comic Sans MS",
		"Consolas",
		"Constantia",
		"Corbel",
		"Courier New",
		"Georgia",
		"Segoe UI",
		"Tahoma",
		"Times New Roman",
		"Trebuchet MS",
		"Verdana",
	],
	macos: [
		"Arial",
		"Avenir Next",
		"Baskerville",
		"Courier",
		"Courier New",
		"Geneva",
		"Georgia",
		"Helvetica",
		"Helvetica Neue",
		"Menlo",
		"Monaco",
		"Times",
		"Times New Roman",
		"Trebuchet MS",
		"Verdana",
	],
};

function normalizeArchitecture(): Pick<
	BrowserIdentity,
	"architecture" | "bitness" | "wow64"
> {
	if (HOST_PLATFORM === "linux") {
		// Keep Linux fingerprints aligned to a mainstream desktop Chrome profile
		// instead of leaking the VPS CPU architecture into UA-CH.
		return { architecture: "x86", bitness: "64", wow64: false };
	}

	if (HOST_PLATFORM === "macos") {
		return { architecture: "x86", bitness: "64", wow64: false };
	}

	switch (process.arch) {
		case "ia32":
			return {
				architecture: "x86",
				bitness: "32",
				wow64: HOST_PLATFORM === "windows",
			};
		case "arm":
			return { architecture: "arm", bitness: "32", wow64: false };
		case "arm64":
			return { architecture: "arm", bitness: "64", wow64: false };
		default:
			return { architecture: "x86", bitness: "64", wow64: false };
	}
}

function normalizePlatformVersion(platform: HostPlatform): string {
	if (platform === "windows") {
		return "10.0.0";
	}

	if (platform === "macos") {
		return "14.0.0";
	}

	const rawVersion = release().split("-")[0] ?? "";
	const segments = rawVersion
		.split(".")
		.map((segment) => segment.trim())
		.filter((segment) => /^\d+$/.test(segment))
		.slice(0, 3);

	while (segments.length < 3) {
		segments.push("0");
	}

	return segments.join(".") || "6.5.0";
}

function normalizeBrowserVersion(browserVersion?: string): {
	majorVersion: string;
	fullVersion: string;
} {
	const match = browserVersion?.match(/(\d+)(?:\.(\d+)\.(\d+)\.(\d+))?/);
	if (!match) {
		return normalizeBrowserVersion(DEFAULT_BROWSER_VERSION);
	}

	const majorVersion =
		match[1] ?? DEFAULT_BROWSER_VERSION.split(".")[0] ?? "143";
	const fullVersion = match[2]
		? `${majorVersion}.${match[2] ?? "0"}.${match[3] ?? "0"}.${match[4] ?? "0"}`
		: `${majorVersion}.0.0.0`;

	return { majorVersion, fullVersion };
}

function formatSecChUa(brands: BrowserBrand[]): string {
	return brands
		.map(({ brand, version }) => `"${brand}";v="${version}"`)
		.join(", ");
}

function formatSecChUaFullVersionList(brands: BrowserBrand[]): string {
	return brands
		.map(({ brand, version }) => `"${brand}";v="${version}"`)
		.join(", ");
}

function buildGreaseBrand(noiseSeed = 0): BrowserBrand {
	const brand =
		UA_GREASE_BRANDS[Math.abs(noiseSeed) % UA_GREASE_BRANDS.length] ??
		UA_GREASE_BRANDS[0];
	return {
		brand,
		version: String(8 + (Math.abs(noiseSeed) % 18)),
	};
}

function buildBrowserIdentity(
	browserVersion?: string,
	noiseSeed?: number,
): BrowserIdentity {
	const { majorVersion, fullVersion } = normalizeBrowserVersion(browserVersion);
	const { architecture, bitness, wow64 } = normalizeArchitecture();
	const greaseBrand = buildGreaseBrand(noiseSeed);
	const brands = [
		{ brand: "Google Chrome", version: majorVersion },
		{ brand: "Chromium", version: majorVersion },
		greaseBrand,
	];
	const fullVersionList = [
		{ brand: "Google Chrome", version: fullVersion },
		{ brand: "Chromium", version: fullVersion },
		{
			brand: greaseBrand.brand,
			version: `${greaseBrand.version}.0.0.0`,
		},
	];
	const userAgentByPlatform: Record<HostPlatform, string> = {
		linux: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${fullVersion} Safari/537.36`,
		windows: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${fullVersion} Safari/537.36`,
		macos: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${fullVersion} Safari/537.36`,
	};
	const platformByHost: Record<
		HostPlatform,
		Pick<BrowserIdentity, "platform" | "platformNavigator" | "model">
	> = {
		linux: {
			platform: "Linux",
			platformNavigator: "Linux x86_64",
			model: "",
		},
		windows: {
			platform: "Windows",
			platformNavigator: "Win32",
			model: "",
		},
		macos: {
			platform: "macOS",
			platformNavigator: "MacIntel",
			model: "",
		},
	};
	const platformIdentity = platformByHost[HOST_PLATFORM];

	return {
		fullVersion,
		userAgent: userAgentByPlatform[HOST_PLATFORM],
		brands,
		fullVersionList,
		fullVersionListHeader: formatSecChUaFullVersionList(fullVersionList),
		platform: platformIdentity.platform,
		platformNavigator: platformIdentity.platformNavigator,
		platformVersion: normalizePlatformVersion(HOST_PLATFORM),
		architecture,
		bitness,
		model: platformIdentity.model,
		mobile: false,
		wow64,
		secChUa: formatSecChUa(brands),
	};
}

function buildWebGlExtensions(profile: SessionProfile): string[] {
	const baseExtensions = [
		"ANGLE_instanced_arrays",
		"EXT_blend_minmax",
		"EXT_color_buffer_half_float",
		"EXT_disjoint_timer_query",
		"EXT_float_blend",
		"EXT_frag_depth",
		"EXT_shader_texture_lod",
		"EXT_sRGB",
		"EXT_texture_compression_bptc",
		"EXT_texture_compression_rgtc",
		"EXT_texture_filter_anisotropic",
		"KHR_parallel_shader_compile",
		"OES_element_index_uint",
		"OES_fbo_render_mipmap",
		"OES_standard_derivatives",
		"OES_texture_float",
		"OES_texture_float_linear",
		"OES_texture_half_float",
		"OES_texture_half_float_linear",
		"OES_vertex_array_object",
		"WEBGL_color_buffer_float",
		"WEBGL_compressed_texture_s3tc",
		"WEBGL_compressed_texture_s3tc_srgb",
		"WEBGL_debug_renderer_info",
		"WEBGL_debug_shaders",
		"WEBGL_depth_texture",
		"WEBGL_draw_buffers",
		"WEBGL_lose_context",
		"WEBGL_multi_draw",
	];

	if (profile.webgl.vendor.includes("NVIDIA")) {
		return [...baseExtensions, "EXT_texture_compression_s3tc"];
	}

	if (profile.webgl.vendor.includes("AMD")) {
		return [...baseExtensions, "EXT_color_buffer_float"];
	}

	return baseExtensions;
}

export function buildWorkerStealthBootstrap(
	profile: SessionProfile,
	browserVersion?: string,
	settings?: BrowserSessionSettings,
): string {
	const identity = buildBrowserIdentity(browserVersion, profile.noiseSeed);
	const webglExtensions = buildWebGlExtensions(profile);
	const sessionSettings = normalizeSessionSettings(settings);
	const languages = buildLanguageList(
		sessionSettings.locale,
		sessionSettings.acceptLanguage,
	);

	return `(function () {
		const profile = ${JSON.stringify(profile)};
		const locale = ${JSON.stringify(sessionSettings.locale)};
		const languages = Object.freeze(${JSON.stringify(languages)});
		const identity = ${JSON.stringify(identity)};
		const configuredTimezone = ${JSON.stringify(
			sessionSettings.timezoneId ?? null,
		)};
		const webglExtensions = Object.freeze(${JSON.stringify(webglExtensions)});
		const patchedFns = new WeakSet();
		const patchedNativeSources = new WeakMap();
		let lastPerformanceNow = 0;

		function mulberry32(seed) {
			let state = seed >>> 0;
			return function () {
				state = (state + 0x6d2b79f5) >>> 0;
				let t = Math.imul(state ^ (state >>> 15), state | 1);
				t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
				return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
			};
		}

		function hashString(value) {
			let hash = 0;
			for (let index = 0; index < value.length; index += 1) {
				hash = Math.imul(31, hash) + value.charCodeAt(index);
				hash |= 0;
			}
			return hash >>> 0;
		}

		function prngForKey(key) {
			return mulberry32((hashString(String(key)) ^ (profile.noiseSeed >>> 0)) >>> 0);
		}

		function clampByte(value) {
			return Math.max(0, Math.min(255, value));
		}

		function getNativeSource(name, kind) {
			switch (kind) {
				case "async":
					return "async function " + name + "() { [native code] }";
				case "getter":
					return "function get " + name + "() { [native code] }";
				default:
					return "function " + name + "() { [native code] }";
			}
		}

		function markNative(fn, source) {
			if (typeof fn === "function") {
				patchedFns.add(fn);
				patchedNativeSources.set(
					fn,
					source || getNativeSource(fn.name || "anonymous", "function"),
				);
			}
			return fn;
		}

		function defineGetter(target, property, getter) {
			Object.defineProperty(target, property, {
				get: markNative(getter, getNativeSource(String(property), "getter")),
				configurable: true,
			});
		}

		function defineReadonlyValue(target, property, value) {
			Object.defineProperty(target, property, {
				value: typeof value === "function" ? markNative(value) : value,
				configurable: true,
				enumerable: false,
				writable: false,
			});
		}

		function cloneImageData(context, imageData) {
			const clone = context.createImageData(imageData.width, imageData.height);
			clone.data.set(imageData.data);
			return clone;
		}

		function buildCanvasSample(imageData) {
			const limit = Math.min(imageData.data.length, 400);
			let sample = imageData.width + "x" + imageData.height + ":";
			for (let index = 0; index < limit; index += 4) {
				sample +=
					imageData.data[index] +
					"," +
					imageData.data[index + 1] +
					"," +
					imageData.data[index + 2] +
					"," +
					imageData.data[index + 3] +
					";";
			}
			return sample;
		}

		function mutateCanvasImageData(imageData) {
			const prng = prngForKey("worker:canvas:" + buildCanvasSample(imageData));
			const pixelLimit = Math.min(imageData.data.length, 400);
			for (let index = 0; index < pixelLimit; index += 4) {
				imageData.data[index] = clampByte(
					imageData.data[index] + (prng() > 0.5 ? 1 : -1),
				);
				imageData.data[index + 1] = clampByte(
					imageData.data[index + 1] + (prng() > 0.5 ? 1 : -1),
				);
			}
		}

		const workerNavigatorPrototype =
			typeof WorkerNavigator !== "undefined"
				? WorkerNavigator.prototype
				: self.navigator
					? Object.getPrototypeOf(self.navigator)
					: null;

		if (workerNavigatorPrototype) {
			defineGetter(workerNavigatorPrototype, "userAgent", function userAgent() {
				return identity.userAgent;
			});
			defineGetter(workerNavigatorPrototype, "platform", function platform() {
				return identity.platformNavigator;
			});
			defineGetter(workerNavigatorPrototype, "language", function language() {
				return locale;
			});
			defineGetter(workerNavigatorPrototype, "languages", function languagesGetter() {
				return languages;
			});
			defineGetter(workerNavigatorPrototype, "vendor", function vendor() {
				return "Google Inc.";
			});
			defineGetter(
				workerNavigatorPrototype,
				"hardwareConcurrency",
				function hardwareConcurrency() {
					return profile.hardwareConcurrency;
				},
			);
			try {
				defineGetter(workerNavigatorPrototype, "deviceMemory", function deviceMemory() {
					return profile.deviceMemory;
				});
			} catch {}
			const uaBrands = Object.freeze(
				identity.brands.map((brand) => Object.freeze({ ...brand })),
			);
			const uaFullVersionList = Object.freeze(
				identity.fullVersionList.map((brand) => Object.freeze({ ...brand })),
			);
			const uaDataPrototype =
				typeof NavigatorUAData !== "undefined"
					? NavigatorUAData.prototype
					: Object.prototype;
			const uaDataValue = Object.create(uaDataPrototype);
			defineReadonlyValue(uaDataValue, "brands", uaBrands);
			defineReadonlyValue(uaDataValue, "mobile", identity.mobile);
			defineReadonlyValue(uaDataValue, "platform", identity.platform);
			defineReadonlyValue(
				uaDataValue,
				"getHighEntropyValues",
				markNative(async function getHighEntropyValues(hints) {
					const values = {
						architecture: identity.architecture,
						bitness: identity.bitness,
						brands: uaBrands,
						fullVersionList: uaFullVersionList,
						mobile: identity.mobile,
						model: identity.model,
						platform: identity.platform,
						platformVersion: identity.platformVersion,
						uaFullVersion: identity.fullVersion,
						wow64: identity.wow64,
					};
					return Object.fromEntries(
						(Array.isArray(hints) ? hints : []).map((hint) => [hint, values[hint]]),
					);
				}),
			);
			defineReadonlyValue(
				uaDataValue,
				"toJSON",
				markNative(function toJSON() {
					return {
						brands: uaBrands,
						mobile: identity.mobile,
						platform: identity.platform,
					};
				}),
			);
			Object.defineProperty(uaDataValue, Symbol.toStringTag, {
				value: "NavigatorUAData",
				configurable: true,
			});
			defineGetter(workerNavigatorPrototype, "userAgentData", function userAgentData() {
				return uaDataValue;
			});
		}

		try {
			const originalPerformanceNow = Performance.prototype.now;
			Performance.prototype.now = markNative(function now() {
				const nextValue =
					originalPerformanceNow.call(this) + (prngForKey("worker:perf")() - 0.5) * 0.1;
				lastPerformanceNow = Math.max(lastPerformanceNow + 0.000001, nextValue);
				return lastPerformanceNow;
			});
		} catch {}

		try {
			if (configuredTimezone && Intl?.DateTimeFormat?.prototype?.resolvedOptions) {
				const originalResolvedOptions =
					Intl.DateTimeFormat.prototype.resolvedOptions;
				Intl.DateTimeFormat.prototype.resolvedOptions = markNative(
					function resolvedOptions() {
						const options = originalResolvedOptions.call(this);
						return {
							...options,
							timeZone: configuredTimezone,
						};
					},
				);
			}
		} catch {}

		try {
			if (Intl?.RelativeTimeFormat?.prototype?.resolvedOptions) {
				const originalResolvedOptions =
					Intl.RelativeTimeFormat.prototype.resolvedOptions;
				Intl.RelativeTimeFormat.prototype.resolvedOptions = markNative(
					function resolvedOptions() {
						const options = originalResolvedOptions.call(this);
						return {
							...options,
							locale,
						};
					},
				);
			}
		} catch {}

		try {
			if (configuredTimezone && typeof Temporal !== "undefined" && Temporal.Now) {
				if (typeof Temporal.Now.timeZoneId === "function") {
					Temporal.Now.timeZoneId = markNative(function timeZoneId() {
						return configuredTimezone;
					});
				}
				if (typeof Temporal.Now.plainDateISO === "function") {
					const originalPlainDateISO = Temporal.Now.plainDateISO.bind(
						Temporal.Now,
					);
					Temporal.Now.plainDateISO = markNative(function plainDateISO(timeZone) {
						return originalPlainDateISO(timeZone || configuredTimezone);
					});
				}
				if (typeof Temporal.Now.plainDateTimeISO === "function") {
					const originalPlainDateTimeISO = Temporal.Now.plainDateTimeISO.bind(
						Temporal.Now,
					);
					Temporal.Now.plainDateTimeISO = markNative(
						function plainDateTimeISO(timeZone) {
							return originalPlainDateTimeISO(timeZone || configuredTimezone);
						},
					);
				}
				if (typeof Temporal.Now.plainTimeISO === "function") {
					const originalPlainTimeISO = Temporal.Now.plainTimeISO.bind(
						Temporal.Now,
					);
					Temporal.Now.plainTimeISO = markNative(function plainTimeISO(timeZone) {
						return originalPlainTimeISO(timeZone || configuredTimezone);
					});
				}
				if (typeof Temporal.Now.zonedDateTimeISO === "function") {
					const originalZonedDateTimeISO = Temporal.Now.zonedDateTimeISO.bind(
						Temporal.Now,
					);
					Temporal.Now.zonedDateTimeISO = markNative(
						function zonedDateTimeISO(timeZone) {
							return originalZonedDateTimeISO(timeZone || configuredTimezone);
						},
					);
				}
			}
		} catch {}

		try {
			const glVendor = profile.webgl.vendor;
			const glRenderer = profile.webgl.renderer;
			const debugRendererInfo = Object.freeze({
				UNMASKED_VENDOR_WEBGL: 37445,
				UNMASKED_RENDERER_WEBGL: 37446,
			});
			if (typeof WebGLRenderingContext !== "undefined") {
				const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
				const originalGetSupportedExtensions =
					WebGLRenderingContext.prototype.getSupportedExtensions;
				const originalGetExtension = WebGLRenderingContext.prototype.getExtension;
				WebGLRenderingContext.prototype.getParameter = markNative(
					function getParameter(parameter) {
						if (parameter === 37445) return glVendor;
						if (parameter === 37446) return glRenderer;
						return originalGetParameter.call(this, parameter);
					},
				);
				WebGLRenderingContext.prototype.getSupportedExtensions = markNative(
					function getSupportedExtensions() {
						const originalExtensions =
							originalGetSupportedExtensions?.call(this) ?? [];
						return Array.from(new Set([...originalExtensions, ...webglExtensions]));
					},
				);
				WebGLRenderingContext.prototype.getExtension = markNative(
					function getExtension(name) {
						if (name === "WEBGL_debug_renderer_info") {
							return debugRendererInfo;
						}
						return originalGetExtension.call(this, name);
					},
				);
			}
			if (typeof WebGL2RenderingContext !== "undefined") {
				const originalGetParameter = WebGL2RenderingContext.prototype.getParameter;
				const originalGetSupportedExtensions =
					WebGL2RenderingContext.prototype.getSupportedExtensions;
				const originalGetExtension = WebGL2RenderingContext.prototype.getExtension;
				WebGL2RenderingContext.prototype.getParameter = markNative(
					function getParameter(parameter) {
						if (parameter === 37445) return glVendor;
						if (parameter === 37446) return glRenderer;
						return originalGetParameter.call(this, parameter);
					},
				);
				WebGL2RenderingContext.prototype.getSupportedExtensions = markNative(
					function getSupportedExtensions() {
						const originalExtensions =
							originalGetSupportedExtensions?.call(this) ?? [];
						return Array.from(new Set([...originalExtensions, ...webglExtensions]));
					},
				);
				WebGL2RenderingContext.prototype.getExtension = markNative(
					function getExtension(name) {
						if (name === "WEBGL_debug_renderer_info") {
							return debugRendererInfo;
						}
						return originalGetExtension.call(this, name);
					},
				);
			}
		} catch {}

		try {
			if (self.navigator?.gpu) {
				if (typeof self.navigator.gpu.getPreferredCanvasFormat === "function") {
					const originalGetPreferredCanvasFormat =
						self.navigator.gpu.getPreferredCanvasFormat.bind(self.navigator.gpu);
					self.navigator.gpu.getPreferredCanvasFormat = markNative(
						function getPreferredCanvasFormat() {
							return originalGetPreferredCanvasFormat();
						},
					);
				}
				if (typeof self.navigator.gpu.requestAdapter === "function") {
					self.navigator.gpu.requestAdapter = markNative(
						async function requestAdapter() {
							return null;
						},
						getNativeSource("requestAdapter", "async"),
					);
				}
			}
		} catch {}

		try {
			if (
				typeof OffscreenCanvas !== "undefined" &&
				typeof OffscreenCanvasRenderingContext2D !== "undefined"
			) {
				if (OffscreenCanvas.prototype.convertToBlob) {
					const originalConvertToBlob = OffscreenCanvas.prototype.convertToBlob;
					OffscreenCanvas.prototype.convertToBlob = markNative(
						function convertToBlob(options) {
							const width = this.width || 0;
							const height = this.height || 0;
							if (width > 0 && height > 0) {
								try {
									const sourceContext = this.getContext("2d", {
										willReadFrequently: true,
									});
									if (sourceContext) {
										const imageData = sourceContext.getImageData(0, 0, width, height);
										const clone = new OffscreenCanvas(width, height);
										const cloneContext = clone.getContext("2d", {
											willReadFrequently: true,
										});
										if (cloneContext) {
											const noisy = cloneImageData(sourceContext, imageData);
											mutateCanvasImageData(noisy);
											cloneContext.putImageData(noisy, 0, 0);
											return originalConvertToBlob.call(clone, options);
										}
									}
								} catch {}
							}
							return originalConvertToBlob.call(this, options);
						},
					);
				}

				const originalGetImageData =
					OffscreenCanvasRenderingContext2D.prototype.getImageData;
				OffscreenCanvasRenderingContext2D.prototype.getImageData = markNative(
					function getImageData(x, y, width, height) {
						const imageData = originalGetImageData.call(this, x, y, width, height);
						const clone = cloneImageData(this, imageData);
						mutateCanvasImageData(clone);
						return clone;
					},
				);

				const originalMeasureText =
					OffscreenCanvasRenderingContext2D.prototype.measureText;
				OffscreenCanvasRenderingContext2D.prototype.measureText = markNative(
					function measureText(text) {
						const metrics = originalMeasureText.call(this, text);
						const prng = prngForKey(
							"worker:measureText:" + String(text) + ":" + (this.font || ""),
						);
						const delta = (prng() - 0.5) * 0.02;
						return new Proxy(metrics, {
							get(target, property, receiver) {
								const value = Reflect.get(target, property, receiver);
								if (
									typeof value === "number" &&
									(property === "width" ||
										String(property).endsWith("BoundingBoxAscent") ||
										String(property).endsWith("BoundingBoxDescent") ||
										String(property).endsWith("Baseline"))
								) {
									return value + delta;
								}
								return typeof value === "function" ? value.bind(target) : value;
							},
						});
					},
				);
			}
		} catch {}

		(function hardenToString() {
			const originalToString = Function.prototype.toString;
			Function.prototype.toString = markNative(function toString() {
				if (patchedFns.has(this)) {
					return (
						patchedNativeSources.get(this) ||
						getNativeSource(this.name || "anonymous", "function")
					);
				}
				return originalToString.call(this);
			});
		})();
	})();`;
}

function buildLanguageList(locale: string, acceptLanguage: string): string[] {
	const values = acceptLanguage
		.split(",")
		.map((part) => part.trim().split(";")[0]?.trim())
		.filter((part): part is string => Boolean(part));

	if (!values.includes(locale)) {
		values.unshift(locale);
	}

	const baseLanguage = locale.split("-")[0]?.trim();
	if (baseLanguage && !values.includes(baseLanguage)) {
		values.push(baseLanguage);
	}

	return Array.from(new Set(values));
}

function normalizeSessionSettings(
	settings?: BrowserSessionSettings,
): BrowserSessionSettings {
	return {
		locale: settings?.locale?.trim() || DEFAULT_LOCALE,
		acceptLanguage: settings?.acceptLanguage?.trim() || DEFAULT_ACCEPT_LANGUAGE,
		timezoneId: settings?.timezoneId?.trim() || DEFAULT_TIMEZONE,
		geolocation: settings?.geolocation ?? DEFAULT_GEOLOCATION,
	};
}

export function getDefaultBrowserSessionSettings(): BrowserSessionSettings {
	return normalizeSessionSettings();
}

function weightedRandom<T>(items: WeightedItem<T>[]): T {
	const fallback = items.at(-1);
	if (!fallback) {
		throw new Error("weightedRandom requires at least one item");
	}

	const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
	let remaining = Math.random() * totalWeight;

	for (const item of items) {
		remaining -= item.weight;
		if (remaining <= 0) return item.value;
	}

	return fallback.value;
}

function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateSessionProfile(): SessionProfile {
	const viewport = weightedRandom(VIEWPORTS);
	const taskbarHeight = randomInt(28, 48);

	return {
		viewport,
		screen: {
			width: viewport.width,
			height: viewport.height,
			availWidth: viewport.width,
			availHeight: viewport.height - taskbarHeight,
		},
		outerDelta: {
			width: randomInt(0, 16),
			height: randomInt(72, 96),
		},
		webgl: weightedRandom(WEBGL_PROFILES[HOST_PLATFORM]),
		deviceMemory: weightedRandom(DEVICE_MEMORY),
		hardwareConcurrency: weightedRandom(HARDWARE_CONCURRENCY),
		noiseSeed: Math.floor(Math.random() * 0x1_0000_0000) >>> 0,
	};
}

export function buildStealthInitScript(
	profile: SessionProfile,
	browserVersion?: string,
	settings?: BrowserSessionSettings,
): string {
	const identity = buildBrowserIdentity(browserVersion, profile.noiseSeed);
	const webglExtensions = buildWebGlExtensions(profile);
	const supportedFontFamilies =
		FONT_FAMILIES_BY_PLATFORM[HOST_PLATFORM] ?? FONT_FAMILIES_BY_PLATFORM.linux;
	const sessionSettings = normalizeSessionSettings(settings);
	const languages = buildLanguageList(
		sessionSettings.locale,
		sessionSettings.acceptLanguage,
	);
	const workerStealthBootstrap = buildWorkerStealthBootstrap(
		profile,
		browserVersion,
		sessionSettings,
	);

	return `(function () {
		const profile = ${JSON.stringify(profile)};
		const locale = ${JSON.stringify(sessionSettings.locale)};
		const languages = Object.freeze(${JSON.stringify(languages)});
		const identity = ${JSON.stringify(identity)};
		const userAgent = identity.userAgent;
		const configuredTimezone = ${JSON.stringify(
			sessionSettings.timezoneId ?? null,
		)};
		const webglExtensions = Object.freeze(${JSON.stringify(webglExtensions)});
		const supportedFontFamilies = Object.freeze(
			${JSON.stringify(supportedFontFamilies)},
		);
		const workerStealthBootstrap = ${JSON.stringify(workerStealthBootstrap)};
		const patchedFns = new WeakSet();
		const patchedNativeSources = new WeakMap();
		const audioNoiseBuffers = new WeakSet();
		let lastPerformanceNow = 0;

		function mulberry32(seed) {
			let state = seed >>> 0;
			return function () {
				state = (state + 0x6d2b79f5) >>> 0;
				let t = Math.imul(state ^ (state >>> 15), state | 1);
				t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
				return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
			};
		}

		const sessionPrng = mulberry32(profile.noiseSeed >>> 0);

		function hashString(value) {
			let hash = 0;
			for (let index = 0; index < value.length; index += 1) {
				hash = Math.imul(31, hash) + value.charCodeAt(index);
				hash |= 0;
			}
			return hash >>> 0;
		}

		function prngForKey(key) {
			return mulberry32((hashString(String(key)) ^ (profile.noiseSeed >>> 0)) >>> 0);
		}

		function clampByte(value) {
			return Math.max(0, Math.min(255, value));
		}

		function getNativeSource(name, kind) {
			switch (kind) {
				case "async":
					return "async function " + name + "() { [native code] }";
				case "generator":
					return "function* " + name + "() { [native code] }";
				case "getter":
					return "function get " + name + "() { [native code] }";
				default:
					return "function " + name + "() { [native code] }";
			}
		}

		function markNative(fn, source) {
			if (typeof fn === "function") {
				patchedFns.add(fn);
				patchedNativeSources.set(
					fn,
					source ||
						getNativeSource(
							fn.name || "anonymous",
							fn.constructor && fn.constructor.name === "AsyncFunction"
								? "async"
								: fn.constructor && fn.constructor.name === "GeneratorFunction"
									? "generator"
									: "function",
						),
				);
			}
			return fn;
		}

		function defineGetter(target, property, getter) {
			const wrappedGetter = markNative(
				getter,
				getNativeSource(String(property), "getter"),
			);
			Object.defineProperty(target, property, {
				get: wrappedGetter,
				configurable: true,
			});
			return wrappedGetter;
		}

		function defineValue(target, property, value) {
			const wrappedValue = typeof value === "function" ? markNative(value) : value;
			Object.defineProperty(target, property, {
				value: wrappedValue,
				configurable: true,
				writable: true,
			});
			return wrappedValue;
		}

		function createPermissionStatus(name, state) {
			const status = new EventTarget();
			Object.setPrototypeOf(status, PermissionStatus.prototype);
			Object.defineProperties(status, {
				name: { value: name, configurable: true },
				state: { value: state, configurable: true },
				onchange: { value: null, configurable: true, writable: true },
			});
			return status;
		}

		function createChromeEvent() {
			return {
				addListener: markNative(function addListener() {}),
				removeListener: markNative(function removeListener() {}),
				hasListeners: markNative(function hasListeners() {
					return false;
				}),
			};
		}

		function createPolicyValue(tagName) {
			const features = Object.freeze([
				"accelerometer",
				"ambient-light-sensor",
				"autoplay",
				"camera",
				"clipboard-read",
				"clipboard-write",
				"display-capture",
				"fullscreen",
				"geolocation",
				"gyroscope",
				"microphone",
				"midi",
				"payment",
				"picture-in-picture",
				"publickey-credentials-get",
				"screen-wake-lock",
				"serial",
				"speaker-selection",
				"usb",
				"web-share",
				"window-management",
			]);

			const value = {
				allowsFeature: markNative(function allowsFeature(feature) {
					return features.includes(String(feature));
				}),
				features: markNative(function featuresList() {
					return [...features];
				}),
				allowedFeatures: markNative(function allowedFeatures() {
					return [...features];
				}),
				getAllowlistForFeature: markNative(function getAllowlistForFeature(
					feature,
				) {
					return features.includes(String(feature)) ? ["self"] : [];
				}),
			};

			Object.defineProperty(value, Symbol.toStringTag, {
				value: tagName,
				configurable: true,
			});

			return value;
		}

		function createEventTargetLike(prototype, descriptors) {
			const value = new EventTarget();
			if (prototype) {
				Object.setPrototypeOf(value, prototype);
			}
			Object.defineProperties(value, descriptors);
			return value;
		}

		function defineReadonlyValue(target, property, value) {
			Object.defineProperty(target, property, {
				value,
				configurable: true,
				enumerable: false,
				writable: false,
			});
		}

		function buildCanvasSample(imageData) {
			const limit = Math.min(imageData.data.length, 400);
			let sample = imageData.width + "x" + imageData.height + ":";
			for (let index = 0; index < limit; index += 4) {
				sample +=
					imageData.data[index] +
					"," +
					imageData.data[index + 1] +
					"," +
					imageData.data[index + 2] +
					"," +
					imageData.data[index + 3] +
					";";
			}
			return sample;
		}

		function cloneImageData(context, imageData) {
			const clone = context.createImageData(imageData.width, imageData.height);
			clone.data.set(imageData.data);
			return clone;
		}

		function get2dContext(canvas) {
			try {
				return canvas.getContext("2d", { willReadFrequently: true });
			} catch {
				return null;
			}
		}

		function mutateCanvasImageData(imageData) {
			const prng = prngForKey("canvas:" + buildCanvasSample(imageData));
			const pixelLimit = Math.min(imageData.data.length, 400);
			for (let index = 0; index < pixelLimit; index += 4) {
				imageData.data[index] = clampByte(
					imageData.data[index] + (prng() > 0.5 ? 1 : -1),
				);
				imageData.data[index + 1] = clampByte(
					imageData.data[index + 1] + (prng() > 0.5 ? 1 : -1),
				);
			}
		}

		function createNoisyCanvasClone(canvas) {
			const width = canvas.width || 0;
			const height = canvas.height || 0;
			if (width <= 0 || height <= 0) {
				return null;
			}

			const sourceContext = get2dContext(canvas);
			if (!sourceContext) {
				return null;
			}

			try {
				const original = sourceContext.getImageData(0, 0, width, height);
				const clone = document.createElement("canvas");
				clone.width = width;
				clone.height = height;

				const cloneContext = get2dContext(clone);
				if (!cloneContext) {
					return null;
				}

				const noisy = cloneImageData(sourceContext, original);
				mutateCanvasImageData(noisy);
				cloneContext.putImageData(noisy, 0, 0);
				return clone;
			} catch {
				return null;
			}
		}

		function createNoisyOffscreenCanvasClone(canvas) {
			const width = canvas.width || 0;
			const height = canvas.height || 0;
			if (
				width <= 0 ||
				height <= 0 ||
				typeof OffscreenCanvas === "undefined"
			) {
				return null;
			}

			const sourceContext = get2dContext(canvas);
			if (!sourceContext) {
				return null;
			}

			try {
				const original = sourceContext.getImageData(0, 0, width, height);
				const clone = new OffscreenCanvas(width, height);
				const cloneContext = get2dContext(clone);
				if (!cloneContext) {
					return null;
				}

				const noisy = cloneImageData(sourceContext, original);
				mutateCanvasImageData(noisy);
				cloneContext.putImageData(noisy, 0, 0);
				return clone;
			} catch {
				return null;
			}
		}

		function normalizeFontFamilyName(value) {
			return String(value).trim().replace(/^['"]|['"]$/g, "").toLowerCase();
		}

		function extractFontFamilies(fontValue) {
			const source = String(fontValue || "");
			const withoutPrefix = source.replace(
				/^(?:normal|italic|oblique|small-caps|bold|bolder|lighter|[1-9]00|\d+)\s+/gi,
				"",
			);
			const match =
				withoutPrefix.match(
					/\d+(?:\.\d+)?(?:px|pt|pc|in|cm|mm|em|rem|ex|ch|vh|vw|vmin|vmax|%)\s*(?:\/\s*[\d.]+(?:px|pt|pc|in|cm|mm|em|rem|ex|ch|vh|vw|vmin|vmax|%))?\s+(.+)$/i,
				) ?? withoutPrefix.match(/(.+)$/);
			const familyList = (match?.[1] ?? withoutPrefix).split(",");
			return familyList
				.map((part) => normalizeFontFamilyName(part))
				.filter(Boolean);
		}

		function isLikelyAvailableFont(fontValue) {
			const genericFamilies = new Set([
				"serif",
				"sans-serif",
				"monospace",
				"cursive",
				"fantasy",
				"system-ui",
				"emoji",
				"math",
				"fangsong",
			]);
			const availableFamilies = new Set(
				supportedFontFamilies.map((family) => normalizeFontFamilyName(family)),
			);
			const families = extractFontFamilies(fontValue);

			if (families.length === 0) {
				return true;
			}

			return families.some((family) => {
				if (genericFamilies.has(family)) {
					return true;
				}
				if (availableFamilies.has(family)) {
					return true;
				}
				return family.includes("emoji") || family.includes("symbol");
			});
		}

		function createPluginValue(definition) {
			const plugin = Object.create(Plugin.prototype);
			const mimeTypes = [];

			defineReadonlyValue(plugin, "name", definition.name);
			defineReadonlyValue(plugin, "filename", definition.filename);
			defineReadonlyValue(plugin, "description", definition.description);
			defineReadonlyValue(plugin, "length", definition.mimeTypes.length);
			defineReadonlyValue(
				plugin,
				"item",
				markNative(function item(index) {
					return mimeTypes[index] ?? null;
				}),
			);
			defineReadonlyValue(
				plugin,
				"namedItem",
				markNative(function namedItem(name) {
					return mimeTypes.find((mimeType) => mimeType.type === name) ?? null;
				}),
			);

			for (let index = 0; index < definition.mimeTypes.length; index += 1) {
				const mimeDefinition = definition.mimeTypes[index];
				const mimeType = Object.create(MimeType.prototype);
				defineReadonlyValue(mimeType, "type", mimeDefinition.type);
				defineReadonlyValue(mimeType, "suffixes", mimeDefinition.suffixes);
				defineReadonlyValue(mimeType, "description", mimeDefinition.description);
				defineReadonlyValue(mimeType, "enabledPlugin", plugin);
				defineReadonlyValue(plugin, index, mimeType);
				defineReadonlyValue(plugin, mimeDefinition.type, mimeType);
				mimeTypes.push(mimeType);
			}

			return { plugin, mimeTypes };
		}

		function sanitizeSdp(sdp) {
			if (!sdp) {
				return sdp;
			}

			return sdp
				.split("\\r\\n")
				.filter((line) => !line || !/ typ host /i.test(line))
				.join("\\r\\n");
		}

		function isBlockedIceCandidate(candidate) {
			return Boolean(candidate && / typ host /i.test(candidate));
		}

		function wrapWorkerScriptURL(scriptURL) {
			try {
				const value = String(scriptURL);
				let source = null;

				if (value.startsWith("blob:")) {
					const xhr = new XMLHttpRequest();
					xhr.open("GET", value, false);
					xhr.send(null);
					if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
						source = xhr.responseText;
					}
				} else if (value.startsWith("data:")) {
					const commaIndex = value.indexOf(",");
					if (commaIndex > -1) {
						const metadata = value.slice(0, commaIndex);
						const body = value.slice(commaIndex + 1);
						source = /;base64/i.test(metadata)
							? atob(body)
							: decodeURIComponent(body);
					}
				}

				if (source === null) {
					return scriptURL;
				}

				return URL.createObjectURL(
					new Blob([workerStealthBootstrap, "\\n;\\n", source], {
						type: "text/javascript",
					}),
				);
			} catch {
				return scriptURL;
			}
		}

		defineGetter(Navigator.prototype, "webdriver", function webdriver() {
			return false;
		});

		defineGetter(Navigator.prototype, "userAgent", function userAgentGetter() {
			return userAgent;
		});

		defineGetter(Navigator.prototype, "platform", function platform() {
			return identity.platformNavigator;
		});

		defineGetter(
			Navigator.prototype,
			"maxTouchPoints",
			function maxTouchPoints() {
				return 0;
			},
		);

		defineGetter(Navigator.prototype, "productSub", function productSub() {
			return "20030107";
		});

		defineGetter(Navigator.prototype, "product", function product() {
			return "Gecko";
		});

		try {
			defineGetter(
				Navigator.prototype,
				"pdfViewerEnabled",
				function pdfViewerEnabled() {
					return true;
				},
			);
		} catch {}

		const uaBrands = Object.freeze(
			identity.brands.map((brand) => Object.freeze({ ...brand })),
		);
		const uaFullVersionList = Object.freeze(
			identity.fullVersionList.map((brand) => Object.freeze({ ...brand })),
		);
		const uaDataPrototype =
			typeof NavigatorUAData !== "undefined"
				? NavigatorUAData.prototype
				: Object.prototype;
		const uaDataValue = Object.create(uaDataPrototype);
		defineReadonlyValue(uaDataValue, "brands", uaBrands);
		defineReadonlyValue(uaDataValue, "mobile", identity.mobile);
		defineReadonlyValue(uaDataValue, "platform", identity.platform);
		defineReadonlyValue(
			uaDataValue,
			"getHighEntropyValues",
			markNative(async function getHighEntropyValues(hints) {
				const values = {
					architecture: identity.architecture,
					bitness: identity.bitness,
					brands: uaBrands,
					fullVersionList: uaFullVersionList,
					mobile: identity.mobile,
					model: identity.model,
					platform: identity.platform,
					platformVersion: identity.platformVersion,
					uaFullVersion: identity.fullVersion,
					wow64: identity.wow64,
				};
				return Object.fromEntries(
					(Array.isArray(hints) ? hints : []).map((hint) => [hint, values[hint]]),
				);
			}),
		);
		defineReadonlyValue(
			uaDataValue,
			"toJSON",
			markNative(function toJSON() {
				return {
					brands: uaBrands,
					mobile: identity.mobile,
					platform: identity.platform,
				};
			}),
		);
		Object.defineProperty(uaDataValue, Symbol.toStringTag, {
			value: "NavigatorUAData",
			configurable: true,
		});
		defineGetter(Navigator.prototype, "userAgentData", function userAgentData() {
			return uaDataValue;
		});

		try {
			if (typeof Worker !== "undefined") {
				const NativeWorker = Worker;
				window.Worker = markNative(function Worker(scriptURL, options) {
					return Reflect.construct(
						NativeWorker,
						[wrapWorkerScriptURL(scriptURL), options],
						new.target || NativeWorker,
					);
				});
				window.Worker.prototype = NativeWorker.prototype;
				Object.setPrototypeOf(window.Worker, NativeWorker);
			}

			if (typeof SharedWorker !== "undefined") {
				const NativeSharedWorker = SharedWorker;
				window.SharedWorker = markNative(function SharedWorker(
					scriptURL,
					options,
				) {
					return Reflect.construct(
						NativeSharedWorker,
						[wrapWorkerScriptURL(scriptURL), options],
						new.target || NativeSharedWorker,
					);
				});
				window.SharedWorker.prototype = NativeSharedWorker.prototype;
				Object.setPrototypeOf(window.SharedWorker, NativeSharedWorker);
			}
		} catch {}

		const chromeObject =
			window.chrome && typeof window.chrome === "object" ? window.chrome : {};

		if (!chromeObject.app) {
			chromeObject.app = {
				isInstalled: false,
				InstallState: {
					DISABLED: "disabled",
					INSTALLED: "installed",
					NOT_INSTALLED: "not_installed",
				},
				RunningState: {
					CANNOT_RUN: "cannot_run",
					READY_TO_RUN: "ready_to_run",
					RUNNING: "running",
				},
				getDetails: markNative(function getDetails() {
					return null;
				}),
				getIsInstalled: markNative(function getIsInstalled() {
					return false;
				}),
				installState: markNative(function installState() {
					return "NOT_INSTALLED";
				}),
				runningState: markNative(function runningState() {
					return "CANNOT_RUN";
				}),
			};
		}

		if (!chromeObject.runtime) {
			chromeObject.runtime = {
				id: undefined,
				connect: markNative(function connect() {
					return {
						disconnect: markNative(function disconnect() {}),
						postMessage: markNative(function postMessage() {}),
						onDisconnect: {
							addListener: markNative(function addListener() {}),
							removeListener: markNative(function removeListener() {}),
						},
						onMessage: {
							addListener: markNative(function addListener() {}),
							removeListener: markNative(function removeListener() {}),
						},
					};
				}),
				sendMessage: markNative(function sendMessage() {}),
				onMessage: {
					addListener: markNative(function addListener() {}),
					removeListener: markNative(function removeListener() {}),
					hasListeners: markNative(function hasListeners() {
						return false;
					}),
				},
				onConnect: {
					addListener: markNative(function addListener() {}),
					removeListener: markNative(function removeListener() {}),
				},
				onInstalled: {
					addListener: markNative(function addListener() {}),
					removeListener: markNative(function removeListener() {}),
				},
			};
		}

		if (!chromeObject.webstore) {
			chromeObject.webstore = {
				onInstallStageChanged: createChromeEvent(),
				onDownloadProgress: createChromeEvent(),
				install: markNative(function install() {}),
			};
		}

		if (!chromeObject.loadTimes) {
			chromeObject.loadTimes = markNative(function loadTimes() {
				return {
					requestTime: performance.timeOrigin / 1000,
					startLoadTime: performance.timeOrigin / 1000,
					commitLoadTime: (performance.timeOrigin + 50) / 1000,
					finishDocumentLoadTime: (performance.timeOrigin + 200) / 1000,
					finishLoadTime: (performance.timeOrigin + 300) / 1000,
					firstPaintTime: (performance.timeOrigin + 150) / 1000,
					firstPaintAfterLoadTime: 0,
					navigationType: "Other",
					wasFetchedViaSpdy: false,
					wasNpnNegotiated: true,
					npnNegotiatedProtocol: "h2",
					wasAlternateProtocolAvailable: false,
					connectionInfo: "h2",
				};
			});
		}

		if (!chromeObject.csi) {
			chromeObject.csi = markNative(function csi() {
				return {
					startE: performance.timeOrigin,
					onloadT: performance.timeOrigin + performance.now(),
					pageT: performance.now(),
					tran: 15,
				};
			});
		}

		Object.defineProperty(window, "chrome", {
			value: chromeObject,
			configurable: true,
			enumerable: true,
			writable: true,
		});

		const pluginDefinitions = [
			{
				name: "PDF Viewer",
				filename: "internal-pdf-viewer",
				description: "Portable Document Format",
				mimeTypes: [
					{
						type: "application/pdf",
						suffixes: "pdf",
						description: "Portable Document Format",
					},
				],
			},
			{
				name: "Chrome PDF Viewer",
				filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
				description: "",
				mimeTypes: [
					{
						type: "text/pdf",
						suffixes: "pdf",
						description: "",
					},
				],
			},
			{
				name: "Chromium PDF Viewer",
				filename: "internal-pdf-viewer",
				description: "",
				mimeTypes: [],
			},
			{
				name: "Microsoft Edge PDF Viewer",
				filename: "AcroPDF.PDF",
				description: "",
				mimeTypes: [],
			},
			{
				name: "WebKit built-in PDF",
				filename: "WebKit built-in PDF",
				description: "",
				mimeTypes: [],
			},
		];
		const pluginRecords = pluginDefinitions.map(createPluginValue);
		const pluginList = pluginRecords.map((record) => record.plugin);
		const mimeTypeList = pluginRecords.flatMap((record) => record.mimeTypes);
		const pluginsValue = Object.create(PluginArray.prototype);
		defineReadonlyValue(pluginsValue, "length", pluginList.length);
		defineReadonlyValue(
			pluginsValue,
			"item",
			markNative(function item(index) {
				return pluginList[index] ?? null;
			}),
		);
		defineReadonlyValue(
			pluginsValue,
			"namedItem",
			markNative(function namedItem(name) {
				return pluginList.find((plugin) => plugin.name === name) ?? null;
			}),
		);
		defineReadonlyValue(
			pluginsValue,
			"refresh",
			markNative(function refresh() {}),
		);
		defineReadonlyValue(
			pluginsValue,
			Symbol.iterator,
			markNative(function* iterator() {
				for (let index = 0; index < pluginList.length; index += 1) {
					yield pluginList[index];
				}
			}),
		);
		for (let index = 0; index < pluginList.length; index += 1) {
			defineReadonlyValue(pluginsValue, index, pluginList[index]);
			defineReadonlyValue(pluginsValue, pluginList[index].name, pluginList[index]);
		}

		defineGetter(Navigator.prototype, "plugins", function plugins() {
			return pluginsValue;
		});

		const mimeTypesValue = Object.create(MimeTypeArray.prototype);
		defineReadonlyValue(mimeTypesValue, "length", mimeTypeList.length);
		defineReadonlyValue(
			mimeTypesValue,
			"item",
			markNative(function item(index) {
				return mimeTypeList[index] ?? null;
			}),
		);
		defineReadonlyValue(
			mimeTypesValue,
			"namedItem",
			markNative(function namedItem(name) {
				return mimeTypeList.find((mimeType) => mimeType.type === name) ?? null;
			}),
		);
		defineReadonlyValue(
			mimeTypesValue,
			Symbol.iterator,
			markNative(function* iterator() {
				for (let index = 0; index < mimeTypeList.length; index += 1) {
					yield mimeTypeList[index];
				}
			}),
		);
		for (let index = 0; index < mimeTypeList.length; index += 1) {
			defineReadonlyValue(mimeTypesValue, index, mimeTypeList[index]);
			defineReadonlyValue(
				mimeTypesValue,
				mimeTypeList[index].type,
				mimeTypeList[index],
			);
		}

		defineGetter(Navigator.prototype, "mimeTypes", function mimeTypes() {
			return mimeTypesValue;
		});

		defineGetter(Navigator.prototype, "language", function language() {
			return locale;
		});

		defineGetter(Navigator.prototype, "languages", function languagesGetter() {
			return languages;
		});

		defineGetter(Navigator.prototype, "vendor", function vendor() {
			return "Google Inc.";
		});

		try {
			if (typeof Notification !== "undefined") {
				defineGetter(Notification, "permission", function permission() {
					return "default";
				});
			}
		} catch {}

		const promptPermissions = new Set([
			"camera",
			"microphone",
			"geolocation",
			"clipboard-read",
			"clipboard-write",
			"payment-handler",
			"midi",
			"usb",
			"notifications",
		]);
		const permissionsValue =
			navigator.permissions && typeof navigator.permissions === "object"
				? navigator.permissions
				: Object.create(Permissions.prototype);
		const originalPermissionsQuery =
			typeof permissionsValue.query === "function"
				? permissionsValue.query.bind(permissionsValue)
				: null;
		defineReadonlyValue(
			permissionsValue,
			"query",
			markNative(function query(parameters) {
				if (parameters?.name && promptPermissions.has(parameters.name)) {
					return Promise.resolve(
						createPermissionStatus(parameters.name, "prompt"),
					);
				}

				if (originalPermissionsQuery) {
					return originalPermissionsQuery(parameters);
				}

				return Promise.resolve(createPermissionStatus("default", "prompt"));
			}),
		);
		if (!navigator.permissions) {
			defineGetter(Navigator.prototype, "permissions", function permissions() {
				return permissionsValue;
			});
		}

		try {
			const featurePolicyValue = createPolicyValue("FeaturePolicy");
			if (!document.featurePolicy) {
				defineGetter(Document.prototype, "featurePolicy", function featurePolicy() {
					return featurePolicyValue;
				});
			}
			if (!document.permissionsPolicy) {
				defineGetter(
					Document.prototype,
					"permissionsPolicy",
					function permissionsPolicy() {
						return featurePolicyValue;
					},
				);
			}
		} catch {}

		defineGetter(
			Navigator.prototype,
			"hardwareConcurrency",
			function hardwareConcurrency() {
				return profile.hardwareConcurrency;
			},
		);

		try {
			defineGetter(Navigator.prototype, "deviceMemory", function deviceMemory() {
				return profile.deviceMemory;
			});
		} catch {}

		try {
			defineGetter(Screen.prototype, "colorDepth", function colorDepth() {
				return 24;
			});
			defineGetter(Screen.prototype, "pixelDepth", function pixelDepth() {
				return 24;
			});
		} catch {}

		try {
			const glVendor = profile.webgl.vendor;
			const glRenderer = profile.webgl.renderer;
			const debugRendererInfo = Object.freeze({
				UNMASKED_VENDOR_WEBGL: 37445,
				UNMASKED_RENDERER_WEBGL: 37446,
			});
			const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
			const originalGetSupportedExtensions =
				WebGLRenderingContext.prototype.getSupportedExtensions;
			const originalGetExtension = WebGLRenderingContext.prototype.getExtension;
			WebGLRenderingContext.prototype.getParameter = markNative(
				function getParameter(parameter) {
					if (parameter === 37445) return glVendor;
					if (parameter === 37446) return glRenderer;
					return originalGetParameter.call(this, parameter);
				},
			);
			WebGLRenderingContext.prototype.getSupportedExtensions = markNative(
				function getSupportedExtensions() {
					const originalExtensions =
						originalGetSupportedExtensions?.call(this) ?? [];
					return Array.from(
						new Set([...originalExtensions, ...webglExtensions]),
					);
				},
			);
			WebGLRenderingContext.prototype.getExtension = markNative(
				function getExtension(name) {
					if (name === "WEBGL_debug_renderer_info") {
						return debugRendererInfo;
					}
					return originalGetExtension.call(this, name);
				},
			);

			if (typeof WebGL2RenderingContext !== "undefined") {
				const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
				const originalGetSupportedExtensions2 =
					WebGL2RenderingContext.prototype.getSupportedExtensions;
				const originalGetExtension2 =
					WebGL2RenderingContext.prototype.getExtension;
				WebGL2RenderingContext.prototype.getParameter = markNative(
					function getParameter(parameter) {
						if (parameter === 37445) return glVendor;
						if (parameter === 37446) return glRenderer;
						return originalGetParameter2.call(this, parameter);
					},
				);
				WebGL2RenderingContext.prototype.getSupportedExtensions = markNative(
					function getSupportedExtensions() {
						const originalExtensions =
							originalGetSupportedExtensions2?.call(this) ?? [];
						return Array.from(
							new Set([...originalExtensions, ...webglExtensions]),
						);
					},
				);
				WebGL2RenderingContext.prototype.getExtension = markNative(
					function getExtension(name) {
						if (name === "WEBGL_debug_renderer_info") {
							return debugRendererInfo;
						}
						return originalGetExtension2.call(this, name);
					},
				);
			}
		} catch {}

		try {
			if (navigator.gpu) {
				if (typeof navigator.gpu.getPreferredCanvasFormat === "function") {
					const originalGetPreferredCanvasFormat =
						navigator.gpu.getPreferredCanvasFormat.bind(navigator.gpu);
					navigator.gpu.getPreferredCanvasFormat = markNative(
						function getPreferredCanvasFormat() {
							return originalGetPreferredCanvasFormat();
						},
					);
				}
				if (typeof navigator.gpu.requestAdapter === "function") {
					navigator.gpu.requestAdapter = markNative(
						async function requestAdapter() {
							return null;
						},
						getNativeSource("requestAdapter", "async"),
					);
				}
			}
		} catch {}

		try {
			defineGetter(window, "outerWidth", function outerWidth() {
				return window.innerWidth + profile.outerDelta.width;
			});
			defineGetter(window, "outerHeight", function outerHeight() {
				return window.innerHeight + profile.outerDelta.height;
			});
		} catch {}

		try {
			defineGetter(Screen.prototype, "width", function width() {
				return profile.screen.width;
			});
			defineGetter(Screen.prototype, "height", function height() {
				return profile.screen.height;
			});
			defineGetter(Screen.prototype, "availWidth", function availWidth() {
				return profile.screen.availWidth;
			});
			defineGetter(Screen.prototype, "availHeight", function availHeight() {
				return profile.screen.availHeight;
			});
		} catch {}

		try {
			const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
			HTMLCanvasElement.prototype.toDataURL = markNative(function toDataURL(
				type,
				quality,
			) {
				const noisyCanvas = createNoisyCanvasClone(this);
				return originalToDataURL.call(noisyCanvas ?? this, type, quality);
			});

			if (HTMLCanvasElement.prototype.toBlob) {
				const originalToBlob = HTMLCanvasElement.prototype.toBlob;
				HTMLCanvasElement.prototype.toBlob = markNative(function toBlob(
					callback,
					type,
					quality,
				) {
					const noisyCanvas = createNoisyCanvasClone(this);
					return originalToBlob.call(noisyCanvas ?? this, callback, type, quality);
				});
			}

			const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
			CanvasRenderingContext2D.prototype.getImageData = markNative(
				function getImageData(x, y, width, height) {
					const imageData = originalGetImageData.call(this, x, y, width, height);
					const clone = cloneImageData(this, imageData);
					const prng = prngForKey(
						"canvas:image-data:" +
							[x, y, width, height, buildCanvasSample(imageData)].join(":"),
					);

					if (clone.data.length >= 4) {
						clone.data[3] = clampByte(
							clone.data[3] + (prng() > 0.5 ? 1 : -1),
						);
					}

					return clone;
				},
			);

			const originalMeasureText = CanvasRenderingContext2D.prototype.measureText;
			CanvasRenderingContext2D.prototype.measureText = markNative(
				function measureText(text) {
					const metrics = originalMeasureText.call(this, text);
					const prng = prngForKey(
						"canvas:measureText:" + String(text) + ":" + (this.font || ""),
					);
					const delta = (prng() - 0.5) * 0.02;
					return new Proxy(metrics, {
						get(target, property, receiver) {
							const value = Reflect.get(target, property, receiver);
							if (
								typeof value === "number" &&
								(property === "width" ||
									String(property).endsWith("BoundingBoxAscent") ||
									String(property).endsWith("BoundingBoxDescent") ||
									String(property).endsWith("Baseline"))
							) {
								return value + delta;
							}
							return typeof value === "function" ? value.bind(target) : value;
						},
					});
				},
			);

			if (
				typeof OffscreenCanvas !== "undefined" &&
				OffscreenCanvas.prototype.convertToBlob
			) {
				const originalConvertToBlob = OffscreenCanvas.prototype.convertToBlob;
				OffscreenCanvas.prototype.convertToBlob = markNative(
					function convertToBlob(options) {
						const noisyCanvas = createNoisyOffscreenCanvasClone(this);
						return originalConvertToBlob.call(noisyCanvas ?? this, options);
					},
				);
			}

			if (typeof OffscreenCanvasRenderingContext2D !== "undefined") {
				const originalOffscreenGetImageData =
					OffscreenCanvasRenderingContext2D.prototype.getImageData;
				OffscreenCanvasRenderingContext2D.prototype.getImageData = markNative(
					function getImageData(x, y, width, height) {
						const imageData = originalOffscreenGetImageData.call(
							this,
							x,
							y,
							width,
							height,
						);
						const clone = cloneImageData(this, imageData);
						mutateCanvasImageData(clone);
						return clone;
					},
				);

				const originalOffscreenMeasureText =
					OffscreenCanvasRenderingContext2D.prototype.measureText;
				OffscreenCanvasRenderingContext2D.prototype.measureText = markNative(
					function measureText(text) {
						const metrics = originalOffscreenMeasureText.call(this, text);
						const prng = prngForKey(
							"offscreen:measureText:" +
								String(text) +
								":" +
								(this.font || ""),
						);
						const delta = (prng() - 0.5) * 0.02;
						return new Proxy(metrics, {
							get(target, property, receiver) {
								const value = Reflect.get(target, property, receiver);
								if (
									typeof value === "number" &&
									(property === "width" ||
										String(property).endsWith("BoundingBoxAscent") ||
										String(property).endsWith("BoundingBoxDescent") ||
										String(property).endsWith("Baseline"))
								) {
									return value + delta;
								}
								return typeof value === "function" ? value.bind(target) : value;
							},
						});
					},
				);
			}
		} catch {}

		try {
			const originalGetChannelData = AudioBuffer.prototype.getChannelData;
			AudioBuffer.prototype.getChannelData = markNative(function getChannelData(
				channel,
			) {
				const data = originalGetChannelData.call(this, channel);
				if (!audioNoiseBuffers.has(this) && data.length > 0) {
					data[0] += (sessionPrng() - 0.5) * 0.0001;
					audioNoiseBuffers.add(this);
				}
				return data;
			});
		} catch {}

		if (!navigator.getBattery) {
			defineValue(navigator, "getBattery", function getBattery() {
				return Promise.resolve(
					createEventTargetLike(
						typeof BatteryManager !== "undefined"
							? BatteryManager.prototype
							: EventTarget.prototype,
						{
							charging: { value: true, configurable: true },
							chargingTime: { value: 0, configurable: true },
							dischargingTime: { value: Infinity, configurable: true },
							level: { value: 1, configurable: true },
							onchargingchange: {
								value: null,
								configurable: true,
								writable: true,
							},
							onchargingtimechange: {
								value: null,
								configurable: true,
								writable: true,
							},
							ondischargingtimechange: {
								value: null,
								configurable: true,
								writable: true,
							},
							onlevelchange: {
								value: null,
								configurable: true,
								writable: true,
							},
						},
					),
				);
			});
		}

		try {
			const connectionValue = createEventTargetLike(
				typeof NetworkInformation !== "undefined"
					? NetworkInformation.prototype
					: EventTarget.prototype,
				{
					downlink: { value: 10, configurable: true },
					downlinkMax: { value: Infinity, configurable: true },
					effectiveType: { value: "4g", configurable: true },
					onchange: { value: null, configurable: true, writable: true },
					rtt: { value: 50, configurable: true },
					saveData: { value: false, configurable: true },
					type: { value: "wifi", configurable: true },
				},
			);
			defineGetter(Navigator.prototype, "connection", function connection() {
				return connectionValue;
			});
		} catch {}

		try {
			const mediaDevicesValue =
				navigator.mediaDevices && typeof navigator.mediaDevices === "object"
					? navigator.mediaDevices
					: createEventTargetLike(
							typeof MediaDevices !== "undefined"
								? MediaDevices.prototype
								: EventTarget.prototype,
							{
								getSupportedConstraints: {
									value: markNative(function getSupportedConstraints() {
										return {};
									}),
									configurable: true,
								},
							},
						);

			defineReadonlyValue(
				mediaDevicesValue,
				"enumerateDevices",
				markNative(async function enumerateDevices() {
					return [];
				}),
			);

			if (!navigator.mediaDevices) {
				defineGetter(Navigator.prototype, "mediaDevices", function mediaDevices() {
					return mediaDevicesValue;
				});
			}
		} catch {}

		try {
			if (
				typeof FontFaceSet !== "undefined" &&
				document.fonts &&
				typeof document.fonts === "object"
			) {
				const originalCheck =
					typeof FontFaceSet.prototype.check === "function"
						? FontFaceSet.prototype.check
						: null;
				const originalLoad =
					typeof FontFaceSet.prototype.load === "function"
						? FontFaceSet.prototype.load
						: null;

				if (originalCheck) {
					FontFaceSet.prototype.check = markNative(function check(font, text) {
						if (typeof font === "string") {
							return isLikelyAvailableFont(font);
						}
						return originalCheck.call(this, font, text);
					});
				}

				if (originalLoad) {
					FontFaceSet.prototype.load = markNative(async function load(font, text) {
						if (typeof font === "string" && !isLikelyAvailableFont(font)) {
							return [];
						}
						return originalLoad.call(this, font, text);
					});
				}
			}
		} catch {}

		try {
			if (typeof window.queryLocalFonts === "function") {
				defineValue(
					window,
					"queryLocalFonts",
					markNative(
						async function queryLocalFonts() {
							throw new DOMException(
								"The request is not allowed by the user agent or the platform in the current context.",
								"NotAllowedError",
							);
						},
						getNativeSource("queryLocalFonts", "async"),
					),
				);
			}
		} catch {}

		try {
			const originalPerformanceNow = Performance.prototype.now;
			Performance.prototype.now = markNative(function now() {
				const nextValue =
					originalPerformanceNow.call(this) + (sessionPrng() - 0.5) * 0.1;
				lastPerformanceNow = Math.max(lastPerformanceNow + 0.000001, nextValue);
				return lastPerformanceNow;
			});
		} catch {}

		try {
			if (configuredTimezone && Intl?.DateTimeFormat?.prototype?.resolvedOptions) {
				const originalResolvedOptions =
					Intl.DateTimeFormat.prototype.resolvedOptions;
				Intl.DateTimeFormat.prototype.resolvedOptions = markNative(
					function resolvedOptions() {
						const options = originalResolvedOptions.call(this);
						return {
							...options,
							timeZone: configuredTimezone,
						};
					},
				);
			}
		} catch {}

		try {
			if (Intl?.RelativeTimeFormat?.prototype?.resolvedOptions) {
				const originalResolvedOptions =
					Intl.RelativeTimeFormat.prototype.resolvedOptions;
				Intl.RelativeTimeFormat.prototype.resolvedOptions = markNative(
					function resolvedOptions() {
						const options = originalResolvedOptions.call(this);
						return {
							...options,
							locale,
						};
					},
				);
			}
		} catch {}

		try {
			if (configuredTimezone && typeof Temporal !== "undefined" && Temporal.Now) {
				if (typeof Temporal.Now.timeZoneId === "function") {
					Temporal.Now.timeZoneId = markNative(function timeZoneId() {
						return configuredTimezone;
					});
				}
				if (typeof Temporal.Now.plainDateISO === "function") {
					const originalPlainDateISO = Temporal.Now.plainDateISO.bind(
						Temporal.Now,
					);
					Temporal.Now.plainDateISO = markNative(function plainDateISO(timeZone) {
						return originalPlainDateISO(timeZone || configuredTimezone);
					});
				}
				if (typeof Temporal.Now.plainDateTimeISO === "function") {
					const originalPlainDateTimeISO = Temporal.Now.plainDateTimeISO.bind(
						Temporal.Now,
					);
					Temporal.Now.plainDateTimeISO = markNative(
						function plainDateTimeISO(timeZone) {
							return originalPlainDateTimeISO(timeZone || configuredTimezone);
						},
					);
				}
				if (typeof Temporal.Now.plainTimeISO === "function") {
					const originalPlainTimeISO = Temporal.Now.plainTimeISO.bind(
						Temporal.Now,
					);
					Temporal.Now.plainTimeISO = markNative(function plainTimeISO(timeZone) {
						return originalPlainTimeISO(timeZone || configuredTimezone);
					});
				}
				if (typeof Temporal.Now.zonedDateTimeISO === "function") {
					const originalZonedDateTimeISO = Temporal.Now.zonedDateTimeISO.bind(
						Temporal.Now,
					);
					Temporal.Now.zonedDateTimeISO = markNative(
						function zonedDateTimeISO(timeZone) {
							return originalZonedDateTimeISO(timeZone || configuredTimezone);
						},
					);
				}
			}
		} catch {}

		try {
			defineValue(Document.prototype, "hasFocus", function hasFocus() {
				return this.visibilityState !== "hidden";
			});
		} catch {}

		try {
			const originalGetBoundingClientRect =
				Element.prototype.getBoundingClientRect;
			Element.prototype.getBoundingClientRect = markNative(
				function getBoundingClientRect() {
					const rect = originalGetBoundingClientRect.call(this);
					const key = [
						this.tagName,
						this.id,
						this.className,
						rect.x.toFixed(4),
						rect.y.toFixed(4),
						rect.width.toFixed(4),
						rect.height.toFixed(4),
					].join("|");
					const prng = prngForKey("domrect:" + key);
					const noiseX = (prng() - 0.5) * 0.02;
					const noiseY = (prng() - 0.5) * 0.02;

					return new DOMRect(
						rect.x + noiseX,
						rect.y + noiseY,
						rect.width,
						rect.height,
					);
				},
			);
		} catch {}

		try {
			const RTCPeerConnectionCtor =
				window.RTCPeerConnection || window.webkitRTCPeerConnection;
			if (RTCPeerConnectionCtor) {
				const wrappedIceListeners = new WeakMap();
				const originalCreateOffer = RTCPeerConnectionCtor.prototype.createOffer;
				RTCPeerConnectionCtor.prototype.createOffer = markNative(
					async function createOffer(...args) {
						const description = await originalCreateOffer.apply(this, args);
						return {
							...description,
							sdp: sanitizeSdp(description?.sdp),
						};
					},
				);

				const originalCreateAnswer = RTCPeerConnectionCtor.prototype.createAnswer;
				RTCPeerConnectionCtor.prototype.createAnswer = markNative(
					async function createAnswer(...args) {
						const description = await originalCreateAnswer.apply(this, args);
						return {
							...description,
							sdp: sanitizeSdp(description?.sdp),
						};
					},
				);

				const originalSetLocalDescription =
					RTCPeerConnectionCtor.prototype.setLocalDescription;
				RTCPeerConnectionCtor.prototype.setLocalDescription = markNative(
					function setLocalDescription(description) {
						if (description?.sdp) {
							return originalSetLocalDescription.call(this, {
								...description,
								sdp: sanitizeSdp(description.sdp),
							});
						}

						return originalSetLocalDescription.call(this, description);
					},
				);

				const originalAddEventListener =
					RTCPeerConnectionCtor.prototype.addEventListener;
				RTCPeerConnectionCtor.prototype.addEventListener = markNative(
					function addEventListener(type, listener, options) {
						if (type !== "icecandidate" || typeof listener !== "function") {
							return originalAddEventListener.call(
								this,
								type,
								listener,
								options,
							);
						}

						const wrappedListener = function wrappedIceCandidate(event) {
							if (isBlockedIceCandidate(event?.candidate?.candidate)) {
								return;
							}
							return listener.call(this, event);
						};
						wrappedIceListeners.set(listener, wrappedListener);
						return originalAddEventListener.call(
							this,
							type,
							markNative(wrappedListener),
							options,
						);
					},
				);

				const originalRemoveEventListener =
					RTCPeerConnectionCtor.prototype.removeEventListener;
				RTCPeerConnectionCtor.prototype.removeEventListener = markNative(
					function removeEventListener(type, listener, options) {
						const wrappedListener =
							type === "icecandidate" && typeof listener === "function"
								? wrappedIceListeners.get(listener) ?? listener
								: listener;
						return originalRemoveEventListener.call(
							this,
							type,
							wrappedListener,
							options,
						);
					},
				);

				const onIceCandidateState = new WeakMap();
				Object.defineProperty(
					RTCPeerConnectionCtor.prototype,
					"onicecandidate",
					{
						get: markNative(function onicecandidate() {
							return onIceCandidateState.get(this)?.listener ?? null;
						}),
						set: markNative(function onicecandidate(listener) {
							const previous = onIceCandidateState.get(this);
							if (previous) {
								originalRemoveEventListener.call(
									this,
									"icecandidate",
									previous.wrapped,
								);
							}

							if (typeof listener !== "function") {
								onIceCandidateState.delete(this);
								return;
							}

							const wrappedListener = function wrappedOnIceCandidate(event) {
								if (isBlockedIceCandidate(event?.candidate?.candidate)) {
									return;
								}
								return listener.call(this, event);
							};
							const nativeWrappedListener = markNative(wrappedListener);
							onIceCandidateState.set(this, {
								listener,
								wrapped: nativeWrappedListener,
							});
							originalAddEventListener.call(
								this,
								"icecandidate",
								nativeWrappedListener,
							);
						}),
						configurable: true,
					},
				);
			}
		} catch {}

		(function hardenToString() {
			const originalToString = Function.prototype.toString;
			Function.prototype.toString = markNative(function toString() {
				if (patchedFns.has(this)) {
					return (
						patchedNativeSources.get(this) ||
						getNativeSource(this.name || "anonymous", "function")
					);
				}
				return originalToString.call(this);
			});
		})();
	})();`;
}

export function buildContextOptions(
	profile: SessionProfile,
	browserVersion?: string,
	settings?: BrowserSessionSettings,
): BrowserContextOptions {
	const identity = buildBrowserIdentity(browserVersion, profile.noiseSeed);
	const sessionSettings = normalizeSessionSettings(settings);
	const options: BrowserContextOptions = {
		viewport: profile.viewport,
		screen: {
			width: profile.screen.width,
			height: profile.screen.height,
		},
		locale: sessionSettings.locale,
		userAgent: identity.userAgent,
		extraHTTPHeaders: {
			"Accept-Language": sessionSettings.acceptLanguage,
			"sec-ch-ua": identity.secChUa,
			"sec-ch-ua-mobile": "?0",
			"sec-ch-ua-platform": `"${identity.platform}"`,
			"sec-ch-ua-full-version": `"${identity.fullVersion}"`,
			"sec-ch-ua-full-version-list": identity.fullVersionListHeader,
			"sec-ch-ua-platform-version": `"${identity.platformVersion}"`,
			"sec-ch-ua-arch": `"${identity.architecture}"`,
			"sec-ch-ua-bitness": `"${identity.bitness}"`,
			"sec-ch-ua-model": `"${identity.model}"`,
			"sec-ch-ua-wow64": identity.wow64 ? "?1" : "?0",
			Accept:
				"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
			"Accept-Encoding": "gzip, deflate, br",
		},
		ignoreHTTPSErrors: true,
	};

	if (sessionSettings.timezoneId) {
		options.timezoneId = sessionSettings.timezoneId;
	}

	if (sessionSettings.geolocation) {
		options.geolocation = sessionSettings.geolocation;
	}

	return options;
}

export function buildChromeArgs(locale = DEFAULT_LOCALE): string[] {
	const args = [
		"--ignore-certificate-errors",
		"--disable-dev-shm-usage",
		`--lang=${locale}`,
		"--mute-audio",
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-background-networking",
		"--disable-sync",
		"--disable-translate",
		"--disable-client-side-phishing-detection",
		"--disable-component-update",
		"--metrics-recording-only",
		"--safebrowsing-disable-auto-update",
		"--disable-ipc-flooding-protection",
		"--font-render-hinting=medium",
		"--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
		"--enforce-webrtc-ip-permission-check",
	];

	return args;
}
