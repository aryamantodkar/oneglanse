import { ContentShell } from "@/components/content/content-shell";
import { ToolTable } from "@/components/content/tool-table";
import { categories, tools, verifiedAt } from "@/content/tools";
import { contentMetadata } from "@/lib/content-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Params = Promise<{ category: string }>;
export function generateStaticParams() {
	return Object.keys(categories).map((category) => ({ category }));
}
export async function generateMetadata({
	params,
}: { params: Params }): Promise<Metadata> {
	const { category } = await params;
	const entry = Object.hasOwn(categories, category)
		? categories[category as keyof typeof categories]
		: undefined;
	return entry
		? contentMetadata(
				entry.title,
				entry.description,
				`/ai-visibility-tools/${category}`,
			)
		: {};
}
export default async function CategoryPage({
	params,
}: { params: Params }): Promise<React.JSX.Element> {
	const { category } = await params;
	const entry = Object.hasOwn(categories, category)
		? categories[category as keyof typeof categories]
		: undefined;
	if (!entry) notFound();
	const items = tools.filter(entry.matches);
	return (
		<ContentShell
			title={entry.title}
			intro={entry.description}
			backLink={{ label: "All AI tools", href: "/ai-visibility-tools" }}
		>
			<p className="mb-5 text-xs text-muted-foreground">
				{items.length} tools · Checked {verifiedAt}
			</p>
			<ToolTable items={items} />
			<div className="mt-8 max-w-3xl space-y-3 text-sm leading-6 text-muted-foreground">
				<h2 className="text-xl font-semibold text-foreground">What to check</h2>
				<ul className="list-disc space-y-2 pl-5">
					{entry.criteria.map((criterion) => (
						<li key={criterion}>{criterion}</li>
					))}
				</ul>
				<p>
					See the other products in the{" "}
					<Link
						href="/ai-visibility-tools"
						className="text-foreground underline underline-offset-4"
					>
						AI tools directory
					</Link>
					.
				</p>
			</div>
		</ContentShell>
	);
}
