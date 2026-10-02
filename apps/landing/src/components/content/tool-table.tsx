import { SourceLinks } from "@/components/content/source-links";
import { comparisons } from "@/content/comparisons";
import type { Tool } from "@/content/tools";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function ToolTable({ items }: { items: Tool[] }): React.JSX.Element {
	return (
		<div className="landing-soft-card overflow-hidden">
			<table className="content-table tool-table w-full table-fixed text-left text-sm">
				<caption className="sr-only">
					AI visibility tools: access, collection method, and capabilities
				</caption>
				<thead className="bg-muted/60">
					<tr>
						<th scope="col" className="w-[19%]">
							Tool
						</th>
						<th scope="col" className="w-[18%]">
							Price / access
						</th>
						<th scope="col" className="w-[20%]">
							How it gets answers
						</th>
						<th scope="col">What it tracks</th>
					</tr>
				</thead>
				<tbody>
					{items.map((tool) => {
						const comparison = comparisons.find(
							(entry) => entry.toolSlug === tool.slug,
						);
						return (
							<tr key={tool.slug}>
								<th scope="row" className="tool-name">
									<a
										className="content-link font-semibold text-foreground"
										href={tool.url}
										target="_blank"
										rel="noreferrer noopener"
									>
										{tool.name}
									</a>
									{tool.openSource && (
										<span className="mt-3 inline-block rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
											Open source{tool.selfHosted ? " · Self-hosted" : ""}
										</span>
									)}
								</th>
								<td data-label="Price / access">{tool.model}</td>
								<td data-label="How it gets answers">{tool.collection}</td>
								<td className="tool-details">
									<p>{tool.summary}</p>
									{comparison && (
										<Link
											className="content-link mt-3 inline-flex items-center gap-1.5 font-medium text-foreground"
											href={`/compare/${comparison.slug}`}
										>
											Compare with OneGlanse
											<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
										</Link>
									)}
									<details className="mt-3">
										<summary className="w-fit cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
											Details & sources ({tool.sources.length})
										</summary>
										<div className="space-y-3 pt-3">
											<p className="text-xs leading-6">
												<span className="font-medium text-foreground">
													AI products:{" "}
												</span>
												{tool.targets}
											</p>
											<SourceLinks sources={tool.sources} />
										</div>
									</details>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
