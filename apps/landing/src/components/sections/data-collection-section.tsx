import { METHOD_POINTS } from "@/lib/landing-content";
import { Card } from "@oneglanse/ui";
import {
	BookOpenText,
	Fingerprint,
	KeyRound,
	Monitor,
	ShieldCheck,
	ShieldOff,
} from "lucide-react";
import Link from "next/link";

export function DataCollectionSection(): React.JSX.Element {
	return (
		<section
			className="section-shell py-10 sm:py-12"
			id="data-methodology"
			aria-labelledby="data-methodology-title"
		>
			<Card className="landing-surface p-5 sm:p-6">
				<h2
					id="data-methodology-title"
					className="text-2xl font-semibold tracking-tight sm:text-3xl"
				>
					Data collection methodology
				</h2>
				<p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
					How collection and model-backed analysis work, and what the results
					can tell you.
				</p>
				<p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
					AI visibility tracking, also called GEO (Generative Engine
					Optimization), describes how brands appear in AI-generated answers.
				</p>

				<ul className="mt-4 grid gap-2">
					{METHOD_POINTS.map((point, index) => (
						<li
							key={point}
							className="landing-muted-card px-3.5 py-3 text-sm text-gray-900 dark:text-gray-100"
						>
							<span className="inline-flex items-center gap-2.5">
								{index === 0 ? (
									<Monitor
										className="h-4 w-4 shrink-0 text-muted-foreground"
										aria-hidden="true"
									/>
								) : null}
								{index === 1 ? (
									<KeyRound
										className="h-4 w-4 shrink-0 text-muted-foreground"
										aria-hidden="true"
									/>
								) : null}
								{index === 2 ? (
									<ShieldCheck
										className="h-4 w-4 shrink-0 text-muted-foreground"
										aria-hidden="true"
									/>
								) : null}
								{index === 3 ? (
									<Fingerprint
										className="h-4 w-4 shrink-0 text-muted-foreground"
										aria-hidden="true"
									/>
								) : null}
								{index === 4 ? (
									<ShieldOff
										className="h-4 w-4 shrink-0 text-muted-foreground"
										aria-hidden="true"
									/>
								) : null}
								<span className="leading-6">{point}</span>
							</span>
						</li>
					))}
				</ul>

				<p className="mt-4 text-sm leading-6 text-muted-foreground">
					Read the collection and comparison protocol:{" "}
					<Link
						href="/methodology"
						className="inline-flex items-center gap-1 text-foreground underline underline-offset-4"
					>
						OneGlanse methodology
						<BookOpenText className="h-3.5 w-3.5" aria-hidden="true" />
					</Link>
				</p>
			</Card>
		</section>
	);
}
