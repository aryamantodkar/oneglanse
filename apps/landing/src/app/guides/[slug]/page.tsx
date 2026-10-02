import { ContentShell } from "@/components/content/content-shell";
import { SourceLinks } from "@/components/content/source-links";
import { guides } from "@/content/guides";
import { contentMetadata } from "@/lib/content-metadata";
import { ArrowRight } from "lucide-react";
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
		? contentMetadata(guide.title, guide.description, `/guides/${slug}`)
		: {};
}
export default async function GuidePage({
	params,
}: { params: Params }): Promise<React.JSX.Element> {
	const { slug } = await params;
	const guide = guides.find((item) => item.slug === slug);
	if (!guide) notFound();
	return (
		<ContentShell
			title={guide.title}
			intro={guide.intro}
			backLink={{ label: "All articles", href: "/guides" }}
		>
			<div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-16">
				<aside className="rounded-xl border border-border p-5 lg:sticky lg:top-28 lg:order-last">
					<nav aria-label="On this page">
						<p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							On this page
						</p>
						<ol className="space-y-3 text-sm leading-6">
							{guide.sections.map((section, index) => (
								<li key={section.heading}>
									<a
										href={`#section-${index + 1}`}
										className="content-link flex gap-3"
									>
										<span className="text-xs tabular-nums text-muted-foreground">
											{String(index + 1).padStart(2, "0")}
										</span>
										{section.heading}
									</a>
								</li>
							))}
						</ol>
					</nav>
				</aside>
				<article className="min-w-0 space-y-10">
					<aside
						className="landing-soft-card p-6 sm:p-7"
						aria-label={guide.example.heading}
					>
						<p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							In practice
						</p>
						<h2 className="mt-3 text-xl font-semibold tracking-tight">
							{guide.example.heading}
						</h2>
						<p className="mt-3 text-sm leading-7 text-muted-foreground">
							{guide.example.text}
						</p>
					</aside>
					{guide.sections.map((section, index) => (
						<section
							key={section.heading}
							id={`section-${index + 1}`}
							className="scroll-mt-40 lg:scroll-mt-28"
						>
							<div className="flex items-baseline gap-3">
								<span
									className="text-sm tabular-nums text-muted-foreground"
									aria-hidden="true"
								>
									{String(index + 1).padStart(2, "0")}
								</span>
								<h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
									{section.heading}
								</h2>
							</div>
							{section.paragraphs.map((paragraph) => (
								<p
									key={paragraph}
									className="mt-4 text-pretty leading-7 text-muted-foreground"
								>
									{paragraph}
								</p>
							))}
						</section>
					))}
					<section className="border-t border-border pt-8">
						<h2 className="mb-4 text-lg font-semibold">Sources</h2>
						<SourceLinks sources={guide.sources} />
					</section>
					<nav
						aria-label="Related guides"
						className="rounded-xl bg-muted/50 p-6"
					>
						<h2 className="mb-4 font-semibold">Keep reading</h2>
						<ul className="space-y-3 text-sm">
							{guides
								.filter((item) => item.slug !== slug)
								.map((item) => (
									<li key={item.slug}>
										<Link
											href={`/guides/${item.slug}`}
											className="content-link flex items-center justify-between gap-4"
										>
											{item.title}
											<ArrowRight
												className="h-3.5 w-3.5 shrink-0"
												aria-hidden="true"
											/>
										</Link>
									</li>
								))}
						</ul>
					</nav>
				</article>
			</div>
		</ContentShell>
	);
}
