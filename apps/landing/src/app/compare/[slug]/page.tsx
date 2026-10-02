import { ContentShell } from "@/components/content/content-shell";
import { SourceLinks } from "@/components/content/source-links";
import { comparisonTool, comparisons } from "@/content/comparisons";
import { tools, verifiedAt } from "@/content/tools";
import { contentMetadata } from "@/lib/content-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Params = Promise<{ slug: string }>;
export function generateStaticParams() {
	return comparisons.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({
	params,
}: { params: Params }): Promise<Metadata> {
	const { slug } = await params;
	const comparison = comparisons.find((item) => item.slug === slug);
	const tool = comparison && comparisonTool(comparison);
	return tool
		? contentMetadata(
				`OneGlanse vs ${tool.name}`,
				comparison?.summary ?? "",
				`/compare/${slug}`,
			)
		: {};
}
export default async function ComparisonPage({
	params,
}: { params: Params }): Promise<React.JSX.Element> {
	const { slug } = await params;
	const comparison = comparisons.find((item) => item.slug === slug);
	const other = comparison && comparisonTool(comparison);
	const oneglanse = tools.find((tool) => tool.slug === "oneglanse");
	if (!comparison || !other || !oneglanse) notFound();
	return (
		<ContentShell
			title={`OneGlanse vs ${other.name}`}
			intro={comparison.summary}
			backLink={{ label: "All comparisons", href: "/compare" }}
		>
			<div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
				<span>Checked {verifiedAt}</span>
				<span aria-hidden="true">·</span>
				<span>Based on public documentation</span>
			</div>
			<div className="landing-soft-card overflow-hidden">
				<table className="content-table comparison-table w-full table-fixed text-left text-sm">
					<caption className="sr-only">
						OneGlanse and {other.name}: access, deployment, collection, and
						reporting
					</caption>
					<thead className="bg-muted/60">
						<tr>
							<th scope="col" className="w-[20%]">
								Compare
							</th>
							<th scope="col" className="w-[40%]">
								OneGlanse
							</th>
							<th scope="col" className="w-[40%]">
								{other.name}
							</th>
						</tr>
					</thead>
					<tbody>
						{[
							["Price / access", oneglanse.model, other.model],
							[
								"Deployment",
								"Local or self-hosted",
								other.selfHosted
									? "Self-hosted or vendor-hosted"
									: "Vendor-hosted service",
							],
							["How it gets answers", oneglanse.collection, other.collection],
							["AI products", oneglanse.targets, other.targets],
							["Reporting", oneglanse.summary, other.summary],
						].map(([label, own, theirs]) => (
							<tr key={label}>
								<th scope="row">{label}</th>
								<td data-label="OneGlanse">{own}</td>
								<td data-label={other.name}>{theirs}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="mt-10 grid gap-8 border-b border-border pb-10 md:grid-cols-2 md:gap-12">
				<section>
					<h2 className="text-xl font-semibold tracking-tight">
						What {other.name} does well
					</h2>
					<p className="mt-3 text-sm leading-7 text-muted-foreground">
						{comparison.otherStrength}
					</p>
				</section>
				<section>
					<h2 className="text-xl font-semibold tracking-tight">
						How they get their answers
					</h2>
					<p className="mt-3 text-sm leading-7 text-muted-foreground">
						{comparison.methodNote}
					</p>
				</section>
			</div>
			<section className="mt-10">
				<h2 className="text-xl font-semibold tracking-tight">
					Which one makes more sense for you?
				</h2>
				<div className="mt-5 grid gap-4 md:grid-cols-2">
					<div className="landing-soft-card p-6">
						<h3 className="font-semibold">OneGlanse makes more sense if...</h3>
						<p className="mt-3 text-sm leading-7 text-muted-foreground">
							{comparison.oneglanseFit}
						</p>
					</div>
					<div className="landing-soft-card p-6">
						<h3 className="font-semibold">
							{other.name} makes more sense if...
						</h3>
						<p className="mt-3 text-sm leading-7 text-muted-foreground">
							{comparison.otherFit}
						</p>
					</div>
				</div>
			</section>
			<section className="mt-10 rounded-xl bg-muted/50 p-6 sm:p-7">
				<h2 className="text-lg font-semibold">Sources and limits</h2>
				<p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
					I build OneGlanse, so this comparison is not independent. I have not
					benchmarked every feature of {other.name}. The claims below come from
					public documentation. Features and AI product access can vary by plan.
				</p>
				<div className="mt-5 space-y-3">
					<SourceLinks sources={oneglanse.sources} />
					<SourceLinks sources={other.sources} />
				</div>
				<p className="mt-6 text-sm">
					<Link href="/ai-visibility-tools" className="content-link">
						Explore all tools
					</Link>
				</p>
			</section>
		</ContentShell>
	);
}
