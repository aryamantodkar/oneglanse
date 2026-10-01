import { ContentShell } from "@/components/content/content-shell";
import { guides } from "@/content/guides";
import { contentMetadata } from "@/lib/content-metadata";
import Link from "next/link";

export const metadata = contentMetadata(
	"AI visibility guides",
	"Plain-language guides to AI visibility, AEO, GEO, and how they relate to SEO.",
	"/guides",
);
export default function GuidesPage(): React.JSX.Element {
	return (
		<ContentShell
			eyebrow="Guides"
			title="Understand AI visibility"
			intro="Definitions, measurement steps, and limits. Start with the question you need to answer."
		>
			<ul className="grid gap-4 sm:grid-cols-2">
				{guides.map((guide) => (
					<li key={guide.slug}>
						<Link
							href={`/guides/${guide.slug}`}
							className="block h-full rounded-xl border border-border p-5 hover:bg-muted"
						>
							<h2 className="text-lg font-semibold">{guide.title}</h2>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								{guide.intro}
							</p>
						</Link>
					</li>
				))}
			</ul>
		</ContentShell>
	);
}
