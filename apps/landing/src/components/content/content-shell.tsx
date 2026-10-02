import { SiteFooter } from "@/components/sections/site-footer";
import { SiteHeader } from "@/components/sections/site-header";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export function ContentShell({
	title,
	intro,
	backLink,
	children,
}: {
	title: string;
	intro: string;
	backLink?: { label: string; href: string };
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<>
			<SiteHeader />
			<main className="section-shell py-10 sm:py-16">
				<div className="mx-auto max-w-5xl">
					<header className="mb-10 max-w-3xl sm:mb-12">
						{backLink ? (
							<Link
								href={backLink.href}
								className="content-link mb-6 inline-flex items-center gap-2 text-sm"
							>
								<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
								{backLink.label}
							</Link>
						) : null}
						<h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
							{title}
						</h1>
						<p className="mt-5 text-pretty text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
							{intro}
						</p>
					</header>
					{children}
				</div>
			</main>
			<SiteFooter />
		</>
	);
}
