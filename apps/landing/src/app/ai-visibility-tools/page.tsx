import { ContentShell } from "@/components/content/content-shell";
import { ToolTable } from "@/components/content/tool-table";
import { comparisons } from "@/content/comparisons";
import { categories, tools, verifiedAt } from "@/content/tools";
import { contentMetadata } from "@/lib/content-metadata";
import Link from "next/link";

export const metadata = contentMetadata(
	"AI visibility tools: open-source, self-hosted and SaaS options",
	"A sourced comparison of AI visibility tools by access model, collection method, and documented capabilities.",
	"/ai-visibility-tools",
);

export default function ToolsPage(): React.JSX.Element {
	return (
		<ContentShell
			eyebrow="Tool directory"
			title="AI visibility tools"
			intro="Compare how tools collect answers, what they report, and who runs the software. This is a map of documented features, not a ranking."
		>
			<nav aria-label="Tool categories" className="mb-8 flex flex-wrap gap-2">
				{Object.entries(categories).map(([slug, category]) => (
					<Link
						key={slug}
						href={`/ai-visibility-tools/${slug}`}
						className="rounded-full border border-border px-4 py-2 text-sm hover:bg-muted"
					>
						{category.title}
					</Link>
				))}
			</nav>
			<ToolTable items={tools} />
			<section className="mt-10 max-w-3xl space-y-3 text-sm leading-6 text-muted-foreground">
				<h2 className="text-xl font-semibold text-foreground">
					How to read this table
				</h2>
				<p>
					“Not stated” means the cited vendor material does not establish a
					collection method. It does not mean the feature is absent.
					Product-interface collection, model APIs, search indexes, and mixed
					pipelines sample different surfaces. Ask each vendor what generated
					the specific metric you plan to compare.
				</p>
				<p>
					Access models and product features were checked on {verifiedAt}.
					Prices, coverage, and plans can change. See each vendor’s linked
					documentation before buying.
				</p>
				<p>
					<Link
						className="text-foreground underline underline-offset-4"
						href="/methodology"
					>
						Read the OneGlanse collection methodology
					</Link>
					.
				</p>
			</section>
			<section className="mt-10">
				<h2 className="text-xl font-semibold">Direct comparisons</h2>
				<ul className="mt-4 grid gap-3 sm:grid-cols-2">
					{comparisons.map((comparison) => {
						const tool = tools.find(
							(item) => item.slug === comparison.toolSlug,
						);
						return (
							<li key={comparison.slug}>
								<Link
									className="block rounded-xl border border-border p-4 hover:bg-muted"
									href={`/compare/${comparison.slug}`}
								>
									OneGlanse vs {tool?.name}
								</Link>
							</li>
						);
					})}
				</ul>
			</section>
			<section className="mt-10">
				<h2 className="text-xl font-semibold">Source records</h2>
				<ul className="mt-4 grid gap-4 sm:grid-cols-2">
					{tools.map((tool) => (
						<li key={tool.slug} className="rounded-xl border border-border p-4">
							<h3 className="font-medium">{tool.name}</h3>
							<ul className="mt-2 space-y-1 text-sm text-muted-foreground">
								{tool.sources.map((source) => (
									<li key={source}>
										<a
											href={source}
											target="_blank"
											rel="noreferrer noopener"
											className="break-all underline underline-offset-4"
										>
											{new URL(source).hostname}
											{new URL(source).pathname}
										</a>
									</li>
								))}
							</ul>
						</li>
					))}
				</ul>
			</section>
		</ContentShell>
	);
}
