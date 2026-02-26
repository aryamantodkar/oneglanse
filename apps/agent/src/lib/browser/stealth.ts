// ── Stealth init script ───────────────────────────────────────────────────────
// Injected via context.addInitScript() — runs BEFORE any page JS, so detection
// scripts never see the real (bot) values.
// 10 signals patched: webdriver, chrome, plugins, mimeTypes, languages,
// vendor, permissions, hardwareConcurrency, deviceMemory, screen.colorDepth
export const STEALTH_INIT_SCRIPT = `(function () {
  // 1. navigator.webdriver — most critical signal
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
    configurable: true,
  });

  // 2. window.chrome — missing = instant bot flag on Google
  //    Real Chrome exposes .app, .runtime, .loadTimes, .csi
  if (!window.chrome) {
    Object.defineProperty(window, 'chrome', {
      writable: true,
      enumerable: true,
      configurable: true,
      value: {
        app: {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        },
        runtime: {
          id: undefined,
          connect: function() {},
          sendMessage: function() {},
        },
        loadTimes: function () { return {}; },
        csi: function () {
          return { startE: Date.now(), onloadT: Date.now(), pageT: 0, tran: 15 };
        },
      },
    });
  }

  // 3. navigator.plugins — empty list = headless signal
  const _plugins = [
    { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
    { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: '' },
    { name: 'Microsoft Edge PDF Viewer', filename: 'AcroPDF.PDF', description: '' },
    { name: 'WebKit built-in PDF', filename: 'WebKit built-in PDF', description: '' },
  ];
  Object.defineProperty(navigator, 'plugins', {
    get: () => Object.assign(
      Object.create(PluginArray.prototype),
      {
        0: _plugins[0], 1: _plugins[1], 2: _plugins[2], 3: _plugins[3], 4: _plugins[4],
        length: 5,
        item: (i) => _plugins[i] ?? null,
        namedItem: (n) => _plugins.find(p => p.name === n) ?? null,
        refresh: function() {},
        [Symbol.iterator]: function* () { for (let i = 0; i < 5; i++) yield _plugins[i]; },
      }
    ),
    configurable: true,
  });

  // 4. navigator.mimeTypes — paired with plugins
  const _mimes = [
    { type: 'application/pdf', suffixes: 'pdf', description: '' },
    { type: 'text/pdf', suffixes: 'pdf', description: '' },
  ];
  Object.defineProperty(navigator, 'mimeTypes', {
    get: () => Object.assign(
      Object.create(MimeTypeArray.prototype),
      {
        0: _mimes[0], 1: _mimes[1],
        length: 2,
        item: (i) => _mimes[i] ?? null,
        namedItem: (n) => _mimes.find(m => m.type === n) ?? null,
        [Symbol.iterator]: function* () { for (let i = 0; i < 2; i++) yield _mimes[i]; },
      }
    ),
    configurable: true,
  });

  // 5. navigator.languages — must match Accept-Language header
  Object.defineProperty(navigator, 'languages', {
    get: () => ['en-US', 'en'],
    configurable: true,
  });

  // 6. navigator.vendor — real Chrome always "Google Inc."
  Object.defineProperty(navigator, 'vendor', {
    get: () => 'Google Inc.',
    configurable: true,
  });

  // 7. Permissions API — headless handles 'notifications' differently
  if (navigator.permissions && navigator.permissions.query) {
    const _origQuery = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = function(params) {
      if (params && params.name === 'notifications') {
        return Promise.resolve(
          Object.setPrototypeOf(
            { state: 'prompt', onchange: null },
            PermissionStatus.prototype,
          )
        );
      }
      return _origQuery(params);
    };
  }

  // 8. Hardware concurrency — 0 is a headless signal
  if (!navigator.hardwareConcurrency) {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
  }

  // 9. Device memory — undefined is a headless signal
  try {
    if (!navigator.deviceMemory) {
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    }
  } catch {} // read-only in some envs

  // 10. Screen color depth — 0 is a headless signal
  if (!screen.colorDepth) {
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });
  }
})();`;

// ── Chrome launch flags ───────────────────────────────────────────────────────
// Extra flags beyond the 3 base sandbox flags (--no-sandbox, --disable-setuid-sandbox,
// --disable-blink-features=AutomationControlled). Applied to all CDP spawn
// launches to ensure consistent fingerprinting across all providers.
export const STEALTH_CHROME_ARGS = [
	"--disable-dev-shm-usage", // critical on Linux VPS / Docker (prevents /dev/shm OOM)
	"--disable-gpu", // no GPU on VPS
	"--window-size=1920,1080", // must match viewport to avoid outlier screen stats
	"--lang=en-US", // locale — must match UA and Accept-Language header
	"--mute-audio",
	"--hide-scrollbars",
	"--no-first-run",
	"--no-default-browser-check",
	"--disable-background-networking",
	"--disable-sync",
	"--disable-translate",
	"--disable-extensions",
	"--disable-plugins-discovery",
	"--disable-client-side-phishing-detection",
	"--disable-component-update",
	"--metrics-recording-only",
	"--safebrowsing-disable-auto-update",
	"--disable-ipc-flooding-protection",
] as const;

// ── User-Agent ────────────────────────────────────────────────────────────────
// Linux UA matches the VPS platform — no navigator.platform mismatch.
// Playwright 1.57 ships Chromium 131, so the version is accurate.
export const STEALTH_USER_AGENT =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// ── Context options ───────────────────────────────────────────────────────────
// Applied to browser.newContext() for all providers.
// Note: viewport is NOT included here — callers set it explicitly so they can
// override dimensions independently of stealth settings.
export const STEALTH_CONTEXT_OPTIONS = {
	userAgent: STEALTH_USER_AGENT,
	locale: "en-US",
	timezoneId: "America/New_York",
	extraHTTPHeaders: {
		"Accept-Language": "en-US,en;q=0.9",
	},
} as const;
