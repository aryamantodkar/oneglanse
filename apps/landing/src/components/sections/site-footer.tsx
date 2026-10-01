import { BrandLogo } from "@/components/common/brand-logo";
import { FOOTER_LINKS } from "@/lib/landing-content";

export function SiteFooter(): React.JSX.Element {
	return (
		<footer className="border-t border-gray-200 py-8 dark:border-gray-800">
			<div className="section-shell flex flex-col gap-4 text-center text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:text-left">
				<div className="flex items-center gap-2">
					<BrandLogo className="h-5 w-5" />
					<p>© {new Date().getFullYear()} OneGlanse</p>
				</div>
				<nav aria-label="Footer links">
					<ul className="flex flex-wrap items-center justify-center gap-4 sm:justify-end">
						{FOOTER_LINKS.map((link) => (
							<li key={link.label}>
								<a
									href={link.href}
									className="hover:text-foreground"
									target={link.href.startsWith("http") ? "_blank" : undefined}
									rel={
										link.href.startsWith("http")
											? "noreferrer noopener"
											: undefined
									}
								>
									{link.label}
								</a>
							</li>
						))}
					</ul>
				</nav>
			</div>
		</footer>
	);
}
