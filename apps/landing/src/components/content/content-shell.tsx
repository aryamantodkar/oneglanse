import { SiteFooter } from "@/components/sections/site-footer";
import { SiteHeader } from "@/components/sections/site-header";

export function ContentShell({
	eyebrow,
	title,
	intro,
	children,
}: {
	eyebrow: string;
	title: string;
	intro: string;
	children: React.ReactNode;
}): React.JSX.Element {
	return (
		<>
			<SiteHeader />
			<main className="section-shell py-12 sm:py-16">
				<div className="mx-auto max-w-5xl">
					<header className="mb-10 max-w-3xl">
						<p className="text-sm font-medium text-muted-foreground">
							{eyebrow}
						</p>
						<h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
							{title}
						</h1>
						<p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
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
