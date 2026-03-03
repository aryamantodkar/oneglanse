import type { ReactNode } from "react";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  trailing?: ReactNode;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  trailing,
}: SectionHeadingProps): React.JSX.Element {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="section-title">{title}</h2>
        {description ? (
          <p className="max-w-2xl text-sm font-medium leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {trailing}
    </div>
  );
}
