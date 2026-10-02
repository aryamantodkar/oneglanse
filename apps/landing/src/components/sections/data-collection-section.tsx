import { Card } from "@oneglanse/ui";
import Link from "next/link";

const steps = [
	{
		title: "Choose your prompts",
		description:
			"Add your brand, competitors, and the questions you want to track.",
	},
	{
		title: "Run them on the real websites",
		description:
			"OneGlanse opens the AI sites with your accounts and saves the answers and citations.",
	},
	{
		title: "Compare the answers",
		description:
			"A model you connect analyzes each answer. The dashboard shows brands, scores, sources, and changes across runs.",
	},
] as const;

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
					How it works
				</h2>
				<ol className="mt-6 grid gap-3 md:grid-cols-3">
					{steps.map((step, index) => (
						<li key={step.title} className="landing-muted-card p-4">
							<p className="text-xs font-semibold text-muted-foreground">
								{String(index + 1).padStart(2, "0")}
							</p>
							<h3 className="mt-2 font-semibold">{step.title}</h3>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								{step.description}
							</p>
						</li>
					))}
				</ol>
				<p className="mt-5 text-sm leading-6 text-muted-foreground">
					<Link href="/methodology" className="content-link">
						Read how OneGlanse collects and scores answers
					</Link>
				</p>
			</Card>
		</section>
	);
}
