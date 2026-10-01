import { BrandLogo } from "@/components/common/brand-logo";
import { FOOTER_LINKS } from "@/lib/landing-content";
import Link from "next/link";

export function SiteFooter(): React.JSX.Element {
	return (
		<footer className="border-t border-gray-200 py-8 dark:border-gray-800">
			<div className="section-shell flex flex-col gap-4 text-center text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:text-left">
				<div className="flex items-center justify-center gap-2 sm:justify-start">
					<BrandLogo alt="" className="h-5 w-5 shrink-0" />
					<p>© {new Date().getFullYear()} OneGlanse</p>
				</div>
				<nav aria-label="Footer links">
					<ul className="flex flex-wrap items-center justify-center gap-4 sm:justify-end">
						{FOOTER_LINKS.map((link) => (
							<li key={link.label}>
								{link.href.startsWith("http") ? (
									<a
										href={link.href}
										className="transition-colors hover:text-foreground"
										target="_blank"
										rel="noreferrer noopener"
									>
										{link.label}
									</a>
								) : (
									<Link
										href={link.href}
										className="transition-colors hover:text-foreground"
									>
										{link.label}
									</Link>
								)}
							</li>
						))}
					</ul>
				</nav>
			</div>
		</footer>
	);
}
