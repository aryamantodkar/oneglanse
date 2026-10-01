import { ContentShell } from "@/components/content/content-shell";
import { contentMetadata } from "@/lib/content-metadata";
import Link from "next/link";

export const metadata = contentMetadata(
	"Why OneGlanse Is Self-Hosted",
	"Why OneGlanse runs locally or on your infrastructure: collecting AI product responses through authenticated browsers is costly to operate at scale.",
	"/why-self-hosted",
);

const hostedRequirements = [
	"Residential proxy capacity and IP reputation",
	"Provider bot detection and verification challenges",
	"Browser fingerprints",
	"Authenticated sessions and session expiry",
	"Provider rate limits",
	"Retries and failed browser runs",
	"UI changes that break automation",
	"Concurrent browser workers and their compute cost",
];

export default function WhySelfHostedPage(): React.JSX.Element {
	return (
		<ContentShell
			eyebrow="Deployment model"
			title="Why OneGlanse Is Self-Hosted"
			intro="OneGlanse does not currently offer a hosted version of the tracking application. It collects responses from real AI product interfaces rather than model APIs, and doing that reliably at scale requires expensive browser infrastructure."
		>
			<article className="max-w-3xl space-y-10 text-base leading-7 text-muted-foreground">
				<p>
					OneGlanse is currently built and maintained by a solo developer. The
					project&apos;s time and resources go toward making the open-source
					product reliable and useful, rather than operating proxy fleets,
					browser infrastructure, and anti-bot systems for a hosted service.
				</p>

				<section className="space-y-4" aria-labelledby="ui-scale">
					<h2 id="ui-scale" className="text-2xl font-semibold text-foreground">
						UI collection is harder to scale than API collection
					</h2>
					<p>
						A typical AI monitoring service can send requests to a model API
						from a server. OneGlanse takes a different path: its Agent opens
						ChatGPT, Perplexity, Gemini, Claude, and Google AI Overview in a
						browser, submits prompts through each product interface, and
						captures the rendered response and available citations.
					</p>
					<p>
						That measures the product surface people use, but a hosted service
						would have to operate many authenticated browsers while managing:
					</p>
					<ul className="grid list-disc gap-x-8 gap-y-2 pl-6 sm:grid-cols-2">
						{hostedRequirements.map((requirement) => (
							<li key={requirement}>{requirement}</li>
						))}
					</ul>
					<p>
						The cost and operational work grow with the number of prompts,
						users, regions, and providers. For a solo-maintained project,
						operating that infrastructure would take substantial time away from
						improving the product.
					</p>
				</section>

				<section className="space-y-4" aria-labelledby="proxies">
					<h2 id="proxies" className="text-2xl font-semibold text-foreground">
						Why proxies matter
					</h2>
					<p>
						Browser automation on cloud servers usually comes from datacenter IP
						ranges. AI product interfaces can challenge, rate-limit, or block
						that traffic more aggressively than residential traffic.
						OneGlanse&apos;s self-hosted mode supports routing provider traffic
						through a residential proxy.
					</p>
					<p>
						Running this centrally for every user would mean paying for proxy
						capacity and managing IP reputation, geography, sessions, and
						provider-specific failures. Self-hosted users instead control the
						proxy and infrastructure for their workload.
					</p>
				</section>

				<section className="space-y-4" aria-labelledby="sessions">
					<h2 id="sessions" className="text-2xl font-semibold text-foreground">
						Authenticated sessions add another constraint
					</h2>
					<p>
						The supported AI products use authenticated user sessions. In local
						mode, you sign in through a browser on your machine. In self-hosted
						mode, you can transfer saved sessions to your own Agent server.
					</p>
					<p>
						A hosted OneGlanse service would also need to securely operate
						third-party account sessions for many users. Keeping the runtime
						under your control avoids making OneGlanse a centralized custodian
						of those sessions.
					</p>
				</section>

				<section className="space-y-4" aria-labelledby="model-apis">
					<h2
						id="model-apis"
						className="text-2xl font-semibold text-foreground"
					>
						Why not just use model APIs?
					</h2>
					<p>
						Model APIs would simplify collection infrastructure, but they would
						change what OneGlanse measures. Product interfaces can add
						retrieval, citations, source cards, recommendation ordering, and
						formatting that differ from the underlying model API. OneGlanse
						exists to observe that product surface.
					</p>
					<p>
						The same design choice that makes UI collection useful also makes
						centralized collection more expensive and difficult to operate
						reliably.
					</p>
					<p>
						Read{" "}
						<Link href="/why-camoufox" className="content-link">
							why OneGlanse moved from Chromium to Camoufox
						</Link>{" "}
						for the engineering history behind its browser choice.
					</p>
				</section>

				<section className="space-y-4" aria-labelledby="hosted-later">
					<h2
						id="hosted-later"
						className="text-2xl font-semibold text-foreground"
					>
						Could OneGlanse offer a hosted version later?
					</h2>
					<p>
						Yes. Operating this infrastructure centrally is possible. It would
						require solving the cost and reliability of browser automation,
						proxy management, bot detection, session handling, and
						provider-specific failures at scale.
					</p>
					<p>
						As a solo developer, that is not where I want to spend the
						project&apos;s resources today. The priority is keeping OneGlanse
						free, open source, and focused on collection and analysis. For now,
						the application runs locally or on infrastructure you control. A
						hosted version can make sense if the project grows enough to justify
						operating collection centrally.
					</p>
				</section>
			</article>
		</ContentShell>
	);
}
