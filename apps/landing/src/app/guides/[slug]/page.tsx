import { ContentShell } from "@/components/content/content-shell";
import { guides } from "@/content/guides";
import { contentMetadata } from "@/lib/content-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Params = Promise<{ slug: string }>;
export function generateStaticParams() {
	return guides.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({
	params,
}: { params: Params }): Promise<Metadata> {
	const { slug } = await params;
	const guide = guides.find((item) => item.slug === slug);
	return guide
		? contentMetadata(guide.title, guide.intro, `/guides/${slug}`)
		: {};
}
export default async function GuidePage({
	params,
}: { params: Params }): Promise<React.JSX.Element> {
	const { slug } = await params;
	const guide = guides.find((item) => item.slug === slug);
	if (!guide) notFound();
	return (
		<ContentShell eyebrow="Guide" title={guide.title} intro={guide.intro}>
			<article className="max-w-3xl space-y-10">
				<aside className="rounded-xl border border-border bg-muted/30 p-5">
					<h2 className="font-semibold">{guide.example.heading}</h2>
					<p className="mt-2 text-sm leading-6 text-muted-foreground">
						{guide.example.text}
					</p>
				</aside>
				{guide.sections.map((section) => (
					<section key={section.heading}>
						<h2 className="text-2xl font-semibold">{section.heading}</h2>
						{section.paragraphs.map((paragraph) => (
							<p
								key={paragraph}
								className="mt-3 leading-7 text-muted-foreground"
							>
								{paragraph}
							</p>
						))}
					</section>
				))}
				<section>
					<h2 className="text-xl font-semibold">Sources and next steps</h2>
					<ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
						{guide.sources.map((source) => (
							<li key={source.url}>
								<a
									href={source.url}
									target="_blank"
									rel="noreferrer noopener"
									className="underline underline-offset-4"
								>
									{source.label}
								</a>
							</li>
						))}
					</ul>
					<p className="mt-5 text-sm">
						Browse the{" "}
						<Link
							href="/ai-visibility-tools"
							className="underline underline-offset-4"
						>
							tool directory
						</Link>{" "}
						or{" "}
						<Link href="/guides" className="underline underline-offset-4">
							all guides
						</Link>
						.
					</p>
				</section>
			</article>
		</ContentShell>
	);
}
