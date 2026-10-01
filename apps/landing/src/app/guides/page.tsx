import { ContentShell } from "@/components/content/content-shell";
import { guides } from "@/content/guides";
import { contentMetadata } from "@/lib/content-metadata";
import { ArrowRight } from "lucide-react";
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
							className="content-card-link group"
						>
							<div className="flex items-start justify-between gap-4">
								<h2 className="text-lg font-semibold tracking-tight">
									{guide.title}
								</h2>
								<ArrowRight
									className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
									aria-hidden="true"
								/>
							</div>
							<p className="mt-2 text-sm leading-6 text-muted-foreground">
								{guide.description}
							</p>
						</Link>
					</li>
				))}
			</ul>
		</ContentShell>
	);
}
