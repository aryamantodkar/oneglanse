import type { Source } from "@/content/sources";
import { ArrowUpRight } from "lucide-react";

export function SourceLinks({
	sources,
}: { sources: Source[] }): React.JSX.Element {
	return (
		<ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
			{sources.map((source) => (
				<li key={source.url}>
					<a
						href={source.url}
						target="_blank"
						rel="noreferrer noopener"
						className="content-link inline-flex items-center gap-1"
					>
						{source.label}
						<ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
					</a>
				</li>
			))}
		</ul>
	);
}
