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

type WeightedItem<T> = {
	value: T;
	weight: number;
};

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

const WEBGL_PROFILES: WeightedItem<SessionProfile["webgl"]>[] = [
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
];

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
const DEFAULT_TIMEZONE = env.BROWSER_TIMEZONE?.trim() || undefined;

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

const DEFAULT_LANGUAGES = buildLanguageList(
	DEFAULT_LOCALE,
	DEFAULT_ACCEPT_LANGUAGE,
);

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
		webgl: weightedRandom(WEBGL_PROFILES),
		deviceMemory: weightedRandom(DEVICE_MEMORY),
		hardwareConcurrency: weightedRandom(HARDWARE_CONCURRENCY),
		noiseSeed: Math.floor(Math.random() * 0x1_0000_0000) >>> 0,
	};
}

export function buildStealthInitScript(profile: SessionProfile): string {
	return `(function () {
		const profile = ${JSON.stringify(profile)};
		const locale = ${JSON.stringify(DEFAULT_LOCALE)};
		const languages = Object.freeze(${JSON.stringify(DEFAULT_LANGUAGES)});
		const patchedFns = new WeakSet();
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

		function markNative(fn) {
			if (typeof fn === "function") {
				patchedFns.add(fn);
			}
			return fn;
		}

		function defineGetter(target, property, getter) {
			const wrappedGetter = markNative(getter);
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

		function buildCanvasSample(imageData) {
			const limit = Math.min(imageData.data.length, 128);
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
			const pixelLimit = Math.min(imageData.data.length, 32);
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

		function createPlugin(details) {
			return Object.assign(Object.create(Plugin.prototype), details);
		}

		function createMimeType(details) {
			return Object.assign(Object.create(MimeType.prototype), details);
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

		defineGetter(Navigator.prototype, "webdriver", function webdriver() {
			return false;
		});

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

		const pluginList = [
			createPlugin({
				name: "PDF Viewer",
				filename: "internal-pdf-viewer",
				description: "Portable Document Format",
			}),
			createPlugin({
				name: "Chrome PDF Viewer",
				filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
				description: "",
			}),
			createPlugin({
				name: "Chromium PDF Viewer",
				filename: "internal-pdf-viewer",
				description: "",
			}),
			createPlugin({
				name: "Microsoft Edge PDF Viewer",
				filename: "AcroPDF.PDF",
				description: "",
			}),
			createPlugin({
				name: "WebKit built-in PDF",
				filename: "WebKit built-in PDF",
				description: "",
			}),
		];
		const pluginsValue = Object.assign(Object.create(PluginArray.prototype), {
			0: pluginList[0],
			1: pluginList[1],
			2: pluginList[2],
			3: pluginList[3],
			4: pluginList[4],
			length: pluginList.length,
			item: markNative(function item(index) {
				return pluginList[index] ?? null;
			}),
			namedItem: markNative(function namedItem(name) {
				return pluginList.find((plugin) => plugin.name === name) ?? null;
			}),
			refresh: markNative(function refresh() {}),
			[Symbol.iterator]: markNative(function* iterator() {
				for (let index = 0; index < pluginList.length; index += 1) {
					yield pluginList[index];
				}
			}),
		});

		defineGetter(Navigator.prototype, "plugins", function plugins() {
			return pluginsValue;
		});

		const mimeTypeList = [
			createMimeType({
				type: "application/pdf",
				suffixes: "pdf",
				description: "",
				enabledPlugin: pluginList[0],
			}),
			createMimeType({
				type: "text/pdf",
				suffixes: "pdf",
				description: "",
				enabledPlugin: pluginList[1],
			}),
		];
		const mimeTypesValue = Object.assign(
			Object.create(MimeTypeArray.prototype),
			{
				0: mimeTypeList[0],
				1: mimeTypeList[1],
				length: mimeTypeList.length,
				item: markNative(function item(index) {
					return mimeTypeList[index] ?? null;
				}),
				namedItem: markNative(function namedItem(name) {
					return mimeTypeList.find((mimeType) => mimeType.type === name) ?? null;
				}),
				[Symbol.iterator]: markNative(function* iterator() {
					for (let index = 0; index < mimeTypeList.length; index += 1) {
						yield mimeTypeList[index];
					}
				}),
			},
		);

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

		if (navigator.permissions?.query) {
			const originalPermissionsQuery = navigator.permissions.query.bind(
				navigator.permissions,
			);
			navigator.permissions.query = markNative(function query(parameters) {
				if (parameters?.name === "notifications") {
					return Promise.resolve(
						Object.setPrototypeOf(
							{ state: "prompt", onchange: null },
							PermissionStatus.prototype,
						),
					);
				}

				return originalPermissionsQuery(parameters);
			});
		}

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
			const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
			WebGLRenderingContext.prototype.getParameter = markNative(
				function getParameter(parameter) {
					if (parameter === 37445) return glVendor;
					if (parameter === 37446) return glRenderer;
					return originalGetParameter.call(this, parameter);
				},
			);

			if (typeof WebGL2RenderingContext !== "undefined") {
				const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
				WebGL2RenderingContext.prototype.getParameter = markNative(
					function getParameter(parameter) {
						if (parameter === 37445) return glVendor;
						if (parameter === 37446) return glRenderer;
						return originalGetParameter2.call(this, parameter);
					},
				);
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
				return Promise.resolve({
					charging: true,
					chargingTime: 0,
					dischargingTime: Infinity,
					level: 1,
					onchargingchange: null,
					onchargingtimechange: null,
					ondischargingtimechange: null,
					onlevelchange: null,
					addEventListener: markNative(function addEventListener() {}),
					removeEventListener: markNative(function removeEventListener() {}),
					dispatchEvent: markNative(function dispatchEvent() {
						return true;
					}),
				});
			});
		}

		try {
			const connectionValue = {
				downlink: 10,
				downlinkMax: Infinity,
				effectiveType: "4g",
				onchange: null,
				rtt: 50,
				saveData: false,
				type: "wifi",
				addEventListener: markNative(function addEventListener() {}),
				removeEventListener: markNative(function removeEventListener() {}),
			};
			defineGetter(Navigator.prototype, "connection", function connection() {
				return connectionValue;
			});
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
			defineValue(Document.prototype, "hasFocus", function hasFocus() {
				return true;
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
					return "function " + (this.name || "anonymous") + "() { [native code] }";
				}
				return originalToString.call(this);
			});
		})();
	})();`;
}

export function buildContextOptions(
	profile: SessionProfile,
): BrowserContextOptions {
	const options: BrowserContextOptions = {
		viewport: profile.viewport,
		screen: {
			width: profile.screen.width,
			height: profile.screen.height,
		},
		locale: DEFAULT_LOCALE,
		extraHTTPHeaders: {
			"Accept-Language": DEFAULT_ACCEPT_LANGUAGE,
		},
		ignoreHTTPSErrors: true,
	};

	if (DEFAULT_TIMEZONE) {
		options.timezoneId = DEFAULT_TIMEZONE;
	}

	return options;
}

export function buildChromeArgs(options?: {
	extensionDir?: string;
}): string[] {
	const args = [
		"--ignore-certificate-errors",
		"--disable-dev-shm-usage",
		`--lang=${DEFAULT_LOCALE}`,
		"--mute-audio",
		"--hide-scrollbars",
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-background-networking",
		"--disable-sync",
		"--disable-translate",
		"--disable-plugins-discovery",
		"--disable-client-side-phishing-detection",
		"--disable-component-update",
		"--metrics-recording-only",
		"--safebrowsing-disable-auto-update",
		"--disable-ipc-flooding-protection",
		"--disable-features=IsolateOrigins,site-per-process",
		"--font-render-hinting=medium",
		"--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
		"--enforce-webrtc-ip-permission-check",
	];

	if (options?.extensionDir) {
		args.push(
			`--disable-extensions-except=${options.extensionDir}`,
			`--load-extension=${options.extensionDir}`,
		);
	} else {
		args.push("--disable-extensions");
	}

	return args;
}
