import { ContentShell } from "@/components/content/content-shell";
import { comparisonTool, comparisons } from "@/content/comparisons";
import { contentMetadata } from "@/lib/content-metadata";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = contentMetadata(
	"Compare AI visibility tools",
	"Five sourced comparisons of OneGlanse with other AI visibility products.",
	"/compare",
);

export default function ComparePage(): React.JSX.Element {
	return (
		<ContentShell
			title="Compare AI visibility tools"
			intro="Side-by-side comparisons of OneGlanse and five other AI visibility products. I use each company’s public documentation and link the sources."
		>
			<ul className="grid gap-4 sm:grid-cols-2">
				{comparisons.map((comparison) => (
					<li key={comparison.slug}>
						<Link
							href={`/compare/${comparison.slug}`}
							className="content-card-link group"
						>
							<div className="flex items-start justify-between gap-4">
								<h2 className="text-lg font-semibold tracking-tight">
									OneGlanse vs {comparisonTool(comparison)?.name}
								</h2>
								<ArrowRight
									className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
									aria-hidden="true"
								/>
							</div>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								{comparison.summary}
							</p>
						</Link>
					</li>
				))}
			</ul>
			<p className="mt-8 text-sm text-muted-foreground">
				See the{" "}
				<Link
					href="/ai-visibility-tools"
					className="text-foreground underline underline-offset-4"
				>
					full tool directory
				</Link>{" "}
				for all source records.
			</p>
		</ContentShell>
	);
}
