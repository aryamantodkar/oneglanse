import { cn } from "@oneglanse/utils";
import type { ReactNode } from "react";

type HeadingTag = "h1" | "h2" | "h3";

export type SectionHeadingProps = {
	eyebrow?: string;
	title: ReactNode;
	description?: ReactNode;
	trailing?: ReactNode;
	as?: HeadingTag;
	titleId?: string;
	className?: string;
	titleClassName?: string;
	descriptionClassName?: string;
	eyebrowClassName?: string;
};

export function SectionHeading({
	eyebrow,
	title,
	description,
	trailing,
	as = "h2",
	titleId,
	className,
	titleClassName,
	descriptionClassName,
	eyebrowClassName,
}: SectionHeadingProps): React.JSX.Element {
	const TitleTag = as;

	return (
		<div
			className={cn(
				"mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
				className,
			)}
		>
			<div className="space-y-1.5">
				{eyebrow ? (
					<p
						className={cn(
							"text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground",
							eyebrowClassName,
						)}
					>
						{eyebrow}
					</p>
				) : null}
				<TitleTag id={titleId} className={cn("section-title", titleClassName)}>
					{title}
				</TitleTag>
				{description ? (
					<p
						className={cn(
							"max-w-2xl text-sm leading-6 text-muted-foreground",
							descriptionClassName,
						)}
					>
						{description}
					</p>
				) : null}
			</div>
			{trailing}
		</div>
	);
}
