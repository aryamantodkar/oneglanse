"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type DiscoveryMenu = {
	label: string;
	href: string;
	items: Array<{ label: string; href: string }>;
};

export function DiscoveryNav({
	menus,
}: {
	menus: DiscoveryMenu[];
}): React.JSX.Element {
	const [openHref, setOpenHref] = useState<string | null>(null);
	const navRef = useRef<HTMLElement>(null);

	useEffect(() => {
		if (!openHref) return;

		const closeOutside = (event: PointerEvent) => {
			if (
				event.target instanceof Node &&
				!navRef.current?.contains(event.target)
			) {
				setOpenHref(null);
			}
		};

		document.addEventListener("pointerdown", closeOutside);
		return () => document.removeEventListener("pointerdown", closeOutside);
	}, [openHref]);

	return (
		<nav
			ref={navRef}
			aria-label="Explore"
			className="relative col-span-2 row-start-2 flex items-center gap-4 border-t border-border pt-3 text-sm font-normal lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:border-0 lg:pt-0"
			onPointerLeave={(event) => {
				if (event.pointerType === "mouse") setOpenHref(null);
			}}
			onBlur={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget))
					setOpenHref(null);
			}}
		>
			{menus.map((menu) => {
				const isOpen = openHref === menu.href;
				const menuId = `discovery-${menu.label.toLowerCase()}`;

				return (
					<div
						key={menu.href}
						className="inline-flex items-center gap-0.5"
						onPointerEnter={(event) => {
							if (event.pointerType === "mouse") setOpenHref(menu.href);
						}}
					>
						<Link
							href={menu.href}
							className="text-foreground/60 transition-colors hover:text-foreground/85 active:opacity-70 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:text-foreground/60 dark:hover:text-foreground/85"
						>
							{menu.label}
						</Link>
						<button
							type="button"
							aria-label={`Browse ${menu.label} pages`}
							aria-controls={isOpen ? menuId : undefined}
							aria-expanded={isOpen}
							className="inline-flex h-6 w-5 items-center justify-center rounded-sm text-foreground/50 transition-colors hover:text-foreground/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring dark:text-foreground/55"
							onClick={() => setOpenHref(menu.href)}
							onKeyDown={(event) => {
								if (event.key === "Escape") setOpenHref(null);
							}}
						>
							<ChevronDown
								className={`h-3 w-3 transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
								aria-hidden="true"
							/>
						</button>
						{isOpen ? (
							<div
								id={menuId}
								className="absolute left-0 top-full z-50 w-[min(21rem,100%)] pt-2 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none"
								onKeyDown={(event) => {
									if (event.key === "Escape") {
										setOpenHref(null);
										navRef.current
											?.querySelector<HTMLButtonElement>(
												`[aria-controls="${menuId}"]`,
											)
											?.focus();
									}
								}}
							>
								<div className="landing-surface overflow-hidden border-border bg-white/98 p-2 shadow-xl dark:bg-neutral-950/98">
									<p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
										Explore {menu.label}
									</p>
									<ul className="max-h-[min(28rem,70vh)] overflow-y-auto pb-1">
										{menu.items.map((item) => (
											<li key={item.href}>
												<Link
													href={item.href}
													className="block rounded-lg px-3 py-2.5 text-sm leading-5 text-foreground/75 transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
													onClick={() => setOpenHref(null)}
												>
													{item.label}
												</Link>
											</li>
										))}
									</ul>
								</div>
							</div>
						) : null}
					</div>
				);
			})}
		</nav>
	);
}
