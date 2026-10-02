import { ContentShell } from "@/components/content/content-shell";
import { contentMetadata } from "@/lib/content-metadata";
import Link from "next/link";

export const metadata = contentMetadata(
	"Why OneGlanse Uses Camoufox Instead of Chromium",
	"The engineering history behind OneGlanse's move from custom Chromium fingerprinting to Camoufox for browser-based AI product collection.",
	"/why-camoufox",
);

const history = [
	{
		date: "March 4",
		label: "Moved from direct CDP control to Playwright Chromium",
		commit: "c7a46129",
	},
	{
		date: "March 4",
		label: "Tried Selenium with Playwright/CDP before returning to Playwright",
		commit: "2b272e6b",
	},
	{
		date: "March 7",
		label: "Tried Rebrowser Playwright",
		commit: "8474fd7a",
	},
	{
		date: "March 7",
		label: "Expanded custom fingerprint handling",
		commit: "5b34fa61",
	},
	{
		date: "March 7",
		label: "Adjusted the VPS browser fonts",
		commit: "47eef53d",
	},
	{
		date: "March 8",
		label:
			"Installed Google Chrome and added sticky proxy sessions and profiles",
		commit: "503d28f4",
	},
	{
		date: "March 9",
		label: "Tried a Chrome extension and native messaging",
		commit: "16c1ad56",
	},
	{
		date: "March 27",
		label: "Replaced the custom Chrome browser layer with Camoufox",
		commit: "49919de2",
	},
	{
		date: "March 29",
		label: "Removed hardcoded OS, screen, and fingerprint overrides",
		commit: "729618f7",
	},
] as const;

const fingerprintSurfaces = [
	"Screen, viewport, and window dimensions",
	"Browser version, user agent, and client hints",
	"Operating system and hardware properties",
	"Fonts, WebGL, and canvas output",
	"Languages, locale, timezone, and geolocation",
	"Worker-context browser properties",
] as const;

export default function WhyCamoufoxPage(): React.JSX.Element {
	return (
		<ContentShell
			title="Why OneGlanse Uses Camoufox Instead of Chromium"
			intro="I started OneGlanse with Chromium. As I added more AI websites and moved runs to a VPS, keeping the browser working became a project of its own."
		>
			<article className="max-w-3xl space-y-10 text-base leading-7 text-muted-foreground">
				<p>
					In March 2026, I moved to Camoufox, a modified Firefox browser built
					for automated browsing. The commit history below shows why.
				</p>

				<section className="space-y-4" aria-labelledby="chromium-approach">
					<h2
						id="chromium-approach"
						className="text-2xl font-semibold text-foreground"
					>
						The original Chromium approach
					</h2>
					<p>
						I tried direct Chrome DevTools Protocol (CDP) control, Playwright
						Chromium, a short Selenium experiment, Rebrowser Playwright, real
						Google Chrome in the VPS image, and a Chrome extension with native
						messaging. My custom fingerprint code modified many browser
						properties:
					</p>
					<ul className="list-disc space-y-1 pl-6">
						{fingerprintSurfaces.map((surface) => (
							<li key={surface}>{surface}</li>
						))}
					</ul>
					<p>
						VPS execution added virtual displays, sparse system fonts, profiles,
						proxy identity, and session state. The project also experimented
						with profile warmups, mouse movement, scrolling, and variable
						typing. Each change had a reason. Keeping all of the signals
						consistent was the harder task. A browser that reports one operating
						system while exposing another system&apos;s fonts or graphics
						properties can stand out more, not less.
					</p>
				</section>

				<section className="space-y-4" aria-labelledby="browser-history">
					<h2
						id="browser-history"
						className="text-2xl font-semibold text-foreground"
					>
						The browser was becoming its own project
					</h2>
					<p>Each step links to the commit that changed the browser setup.</p>
					<ol className="space-y-3 border-l border-border pl-5">
						{history.map((step) => (
							<li key={step.commit}>
								<span className="font-medium text-foreground">
									{step.date}, 2026:
								</span>{" "}
								<a
									href={`https://github.com/oneglanse/oneglanse/commit/${step.commit}`}
									className="content-link"
									target="_blank"
									rel="noreferrer noopener"
								>
									{step.label}
								</a>
							</li>
						))}
					</ol>
					<p>
						Chromium can be automated. But I was maintaining more and more
						browser fingerprint code instead of working on prompts, answers, and
						citations.
					</p>
				</section>

				<section className="space-y-4" aria-labelledby="why-camoufox">
					<h2
						id="why-camoufox"
						className="text-2xl font-semibold text-foreground"
					>
						Why I chose Camoufox
					</h2>
					<p>
						<a
							href="https://github.com/daijro/camoufox"
							className="content-link"
							target="_blank"
							rel="noreferrer noopener"
						>
							Camoufox
						</a>{" "}
						modifies Firefox itself. It handles many fingerprint properties
						inside the browser, instead of relying mainly on JavaScript patches
						after a page loads. Its launcher uses BrowserForge to generate
						plausible combinations of device, screen, locale, font, and graphics
						properties. Playwright controls it through Firefox&apos;s Juggler
						path rather than Chromium&apos;s CDP path.
					</p>
					<p>
						That let me remove several hardcoded fingerprint overrides and get
						back to OneGlanse: keeping logins working, running prompts, saving
						answers and citations, and retrying failed runs.
					</p>
				</section>

				<section className="space-y-4" aria-labelledby="detection-limits">
					<h2
						id="detection-limits"
						className="text-2xl font-semibold text-foreground"
					>
						Camoufox does not eliminate bot detection
					</h2>
					<p>
						Provider interfaces can still challenge automated traffic.
						Datacenter IP reputation, blocked proxies, expired sessions, UI
						changes, CAPTCHAs, Cloudflare, Turnstile, and rate limits still
						matter. OneGlanse still detects challenge pages and handles proxy
						failures. Camoufox is one part of collection, not a promise that
						browser sessions will never be detected.
					</p>
					<p>
						Camoufox reduced the fingerprint code I maintain. I have not run a
						controlled benchmark of detection rates.
					</p>
				</section>

				<section className="space-y-4" aria-labelledby="why-it-matters">
					<h2
						id="why-it-matters"
						className="text-2xl font-semibold text-foreground"
					>
						Why the browser matters here
					</h2>
					<p>
						A product interface can include retrieval, citations, source cards,
						and ordering that differ from a model API response. OneGlanse uses
						the browser to observe that product surface. The browser choice
						therefore affects the reliability of the data it can collect, even
						though the analysis step runs separately.
					</p>
				</section>

				<section className="space-y-4" aria-labelledby="camoufox-credit">
					<h2
						id="camoufox-credit"
						className="text-2xl font-semibold text-foreground"
					>
						Credit to Camoufox
					</h2>
					<p>
						OneGlanse&apos;s collection layer depends on the work of the
						Camoufox contributors. The project began at{" "}
						<a
							href="https://github.com/daijro/camoufox"
							className="content-link"
							target="_blank"
							rel="noreferrer noopener"
						>
							daijro/camoufox
						</a>
						. Current browser development also occurs at{" "}
						<a
							href="https://github.com/CloverLabsAI/camoufox"
							className="content-link"
							target="_blank"
							rel="noreferrer noopener"
						>
							Clover Labs
						</a>
						. OneGlanse currently installs the `cloverlabs-camoufox` Python
						package. These contributors maintain the browser layer that lets
						OneGlanse spend more effort on collection and analysis.
					</p>
					<p>
						For the wider infrastructure tradeoff, read{" "}
						<Link href="/why-self-hosted" className="content-link">
							why OneGlanse is self-hosted
						</Link>
						. For how a collected answer is interpreted, read the{" "}
						<Link href="/methodology" className="content-link">
							collection methodology
						</Link>
						.
					</p>
				</section>
			</article>
		</ContentShell>
	);
}
