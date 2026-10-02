import { ContentShell } from "@/components/content/content-shell";
import { ToolTable } from "@/components/content/tool-table";
import { categories, tools, verifiedAt } from "@/content/tools";
import { contentMetadata } from "@/lib/content-metadata";
import Link from "next/link";

export const metadata = contentMetadata(
	"AI visibility tools: open-source, self-hosted and SaaS options",
	"Compare AI visibility tools by price, how they get answers, and what they track. Each entry links to public sources.",
	"/ai-visibility-tools",
);

export default function ToolsPage(): React.JSX.Element {
	return (
		<ContentShell
			title="AI visibility tools"
			intro={`A list of ${tools.length} AI visibility products, what they track, how they get their answers, and whether you can run them yourself. I link sources for each entry.`}
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
					“Not stated in public docs” means I could not verify how that product
					gets its answers. It does not mean the product uses an API. Some
					products use websites for certain AI tools and APIs for others.
				</p>
				<p>
					I build OneGlanse, so this is not an independent comparison. I have
					not benchmarked every product here. The table uses each company’s
					public documentation, linked beside its entry. Features and AI tool
					access can depend on the plan.
				</p>
				<p>
					<Link className="content-link" href="/methodology">
						Read how OneGlanse gets its data
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
