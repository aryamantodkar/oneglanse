import { ContentShell } from "@/components/content/content-shell";
import { comparisons, comparisonTool } from "@/content/comparisons";
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
			eyebrow="Product comparison"
			title={`OneGlanse vs ${other.name}`}
			intro={comparison.summary}
		>
			<div className="overflow-x-auto rounded-xl border border-border">
				<table className="w-full min-w-[580px] text-left text-sm">
					<thead className="bg-muted/50">
						<tr>
							<th className="p-4">Criterion</th>
							<th className="p-4">OneGlanse</th>
							<th className="p-4">{other.name}</th>
						</tr>
					</thead>
					<tbody>
						{[
							["Access", oneglanse.model, other.model],
							[
								"Deployment",
								"Local or self-hosted",
								other.selfHosted
									? "Self-hosted option"
									: "Vendor-hosted service",
							],
							["Collection", oneglanse.collection, other.collection],
						].map(([label, own, theirs]) => (
							<tr key={label} className="border-t border-border">
								<th className="p-4 font-medium">{label}</th>
								<td className="p-4 text-muted-foreground">{own}</td>
								<td className="p-4 text-muted-foreground">{theirs}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div className="mt-10 grid gap-8 md:grid-cols-2">
				<section>
					<h2 className="text-xl font-semibold">
						Where {other.name} is stronger
					</h2>
					<p className="mt-3 leading-7 text-muted-foreground">
						{comparison.otherStrength}
					</p>
				</section>
				<section>
					<h2 className="text-xl font-semibold">Collection method</h2>
					<p className="mt-3 leading-7 text-muted-foreground">
						{comparison.methodNote}
					</p>
				</section>
			</div>
			<section className="mt-10">
				<h2 className="text-xl font-semibold">Which fits your work?</h2>
				<div className="mt-4 grid gap-4 md:grid-cols-2">
					<div className="rounded-xl border border-border p-5">
						<h3 className="font-semibold">Choose OneGlanse</h3>
						<p className="mt-2 leading-7 text-muted-foreground">
							{comparison.oneglanseFit}
						</p>
					</div>
					<div className="rounded-xl border border-border p-5">
						<h3 className="font-semibold">Choose {other.name}</h3>
						<p className="mt-2 leading-7 text-muted-foreground">
							{comparison.otherFit}
						</p>
					</div>
				</div>
			</section>
			<section className="mt-10 max-w-3xl">
				<h2 className="text-xl font-semibold">Sources and limits</h2>
				<p className="mt-3 text-sm leading-6 text-muted-foreground">
					Checked {verifiedAt}. This is a comparison of published capabilities,
					not a hands-on benchmark. Pricing, engine coverage, and product
					behavior can change. A listed capability may depend on a plan. Verify
					current terms with the vendor.
				</p>
				<ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
					{[...oneglanse.sources, ...other.sources].map((source) => (
						<li key={source}>
							<a
								href={source}
								target="_blank"
								rel="noreferrer noopener"
								className="break-all underline underline-offset-4"
							>
								{source}
							</a>
						</li>
					))}
				</ul>
				<p className="mt-5 text-sm">
					Read{" "}
					<Link href="/methodology" className="underline underline-offset-4">
						OneGlanse's collection methodology
					</Link>{" "}
					or browse the{" "}
					<Link
						href="/ai-visibility-tools"
						className="underline underline-offset-4"
					>
						full directory
					</Link>
					.
				</p>
			</section>
		</ContentShell>
	);
}
