import { ContentShell } from "@/components/content/content-shell";
import { comparisons, comparisonTool } from "@/content/comparisons";
import { contentMetadata } from "@/lib/content-metadata";
import Link from "next/link";

export const metadata = contentMetadata(
	"Compare AI visibility tools",
	"Five sourced comparisons of OneGlanse with other AI visibility products.",
	"/compare",
);

export default function ComparePage(): React.JSX.Element {
	return (
		<ContentShell
			eyebrow="Comparisons"
			title="Compare AI visibility tools"
			intro="Choose by collection surface, deployment model, and the work you need to do. Each comparison links to the vendor's own documentation."
		>
			<ul className="grid gap-4 sm:grid-cols-2">
				{comparisons.map((comparison) => (
					<li key={comparison.slug}>
						<Link
							href={`/compare/${comparison.slug}`}
							className="block h-full rounded-xl border border-border p-5 hover:bg-muted"
						>
							<h2 className="text-lg font-semibold">
								OneGlanse vs {comparisonTool(comparison)?.name}
							</h2>
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
