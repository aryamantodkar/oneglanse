import { OPEN_SOURCE_POINTS, SITE_URLS } from "@/lib/landing-content";
import { Button, Card } from "@oneglanse/ui";
import { Github, Server } from "lucide-react";

export function OpenSourceSection(): React.JSX.Element {
	return (
		<section
			className="section-shell py-12 sm:py-14"
			id="open-source"
			aria-labelledby="open-source-title"
		>
			<Card className="landing-surface p-6">
				<div className="grid items-stretch gap-7 lg:grid-cols-[1.1fr_1fr]">
					<div className="flex flex-col">
						<h2
							id="open-source-title"
							className="text-2xl font-semibold tracking-tight sm:text-3xl"
						>
							Open by design. Deploy on your terms.
						</h2>
						<p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
							Self-host the full stack and keep full control over data, runtime,
							and observability.
						</p>
						<div className="mt-auto flex flex-wrap gap-3 pt-6">
							<Button asChild variant="outline">
								<a
									href={SITE_URLS.github}
									target="_blank"
									rel="noreferrer noopener"
								>
									<Github className="h-4 w-4" aria-hidden="true" />
									View on GitHub
								</a>
							</Button>
							<Button asChild>
								<a
									href={SITE_URLS.docs}
									target="_blank"
									rel="noreferrer noopener"
								>
									<Server className="h-4 w-4" aria-hidden="true" />
									Self-host Instructions
								</a>
							</Button>
						</div>
					</div>
					<ul className="grid gap-2.5">
						{OPEN_SOURCE_POINTS.map(({ text, icon: Icon }) => (
							<li
								key={text}
								className="landing-muted-card px-3.5 py-3 text-sm text-gray-900 dark:text-gray-100"
							>
								<span className="inline-flex items-center gap-2.5">
									<Icon
										className="h-4 w-4 shrink-0 text-muted-foreground"
										aria-hidden="true"
									/>
									<span className="leading-6">{text}</span>
								</span>
							</li>
						))}
					</ul>
				</div>
			</Card>
		</section>
	);
}
