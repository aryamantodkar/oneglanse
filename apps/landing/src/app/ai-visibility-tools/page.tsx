import { ContentShell } from "@/components/content/content-shell";
import { ToolTable } from "@/components/content/tool-table";
import { categories, tools, verifiedAt } from "@/content/tools";
import { contentMetadata } from "@/lib/content-metadata";
import Link from "next/link";

export const metadata = contentMetadata(
	"AI visibility tools: open-source, self-hosted and SaaS options",
	"Compare AI visibility tools by access, collection method, and documented capabilities. Includes vendor sources and open-source options.",
	"/ai-visibility-tools",
);

export default function ToolsPage(): React.JSX.Element {
	return (
		<ContentShell
			eyebrow="Tool directory"
			title="AI visibility tools"
			intro={`Compare collection methods, reporting, and deployment. ${tools.length} tools, with sources beside each entry. This is a feature guide, not a ranking.`}
		>
			<div className="mb-6 flex flex-wrap items-center justify-between gap-4">
				<nav aria-label="Tool categories" className="flex flex-wrap gap-2">
					{Object.entries(categories).map(([slug, category]) => (
						<Link
							key={slug}
							href={`/ai-visibility-tools/${slug}`}
							className="content-filter"
						>
							{category.label}
							<span className="ml-2 text-muted-foreground">
								{tools.filter(category.matches).length}
							</span>
						</Link>
					))}
				</nav>
				<p className="text-xs text-muted-foreground">Checked {verifiedAt}</p>
			</div>
			<ToolTable items={tools} />
			<section className="mt-10 max-w-3xl space-y-3 text-sm leading-6 text-muted-foreground">
				<h2 className="text-xl font-semibold text-foreground">
					How to use this directory
				</h2>
				<p>
					“Not disclosed” means the cited sources do not establish a collection
					method. It does not establish API use. For mixed pipelines, check the
					target behind each result.
				</p>
				<p>
					We publish OneGlanse. These entries describe public documentation, not
					hands-on benchmarks. Target lists can be examples rather than full
					catalogs. Coverage and features can depend on a plan. Confirm current
					terms with each vendor.
				</p>
				<p>
					<Link className="content-link" href="/methodology">
						Read our collection methodology
					</Link>{" "}
					or{" "}
					<Link className="content-link" href="/compare">
						browse direct comparisons
					</Link>
					.
				</p>
			</section>
		</ContentShell>
	);
}
