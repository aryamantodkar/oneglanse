import type { Tool } from "@/content/tools";
import Link from "next/link";

export function ToolTable({ items }: { items: Tool[] }): React.JSX.Element {
	return (
		<div className="overflow-x-auto rounded-xl border border-border">
			<table className="w-full min-w-[780px] text-left text-sm">
				<thead className="bg-muted/50">
					<tr>
						<th className="p-4 font-semibold">Tool</th>
						<th className="p-4 font-semibold">Access</th>
						<th className="p-4 font-semibold">Collection</th>
						<th className="p-4 font-semibold">What it covers</th>
					</tr>
				</thead>
				<tbody>
					{items.map((tool) => (
						<tr key={tool.slug} className="border-t border-border align-top">
							<td className="p-4 font-medium">
								<a
									className="underline underline-offset-4"
									href={tool.url}
									target="_blank"
									rel="noreferrer noopener"
								>
									{tool.name}
								</a>
								{tool.openSource && (
									<span className="mt-1 block text-xs text-muted-foreground">
										Open source{tool.selfHosted ? " · Self-hosted" : ""}
									</span>
								)}
							</td>
							<td className="p-4 text-muted-foreground">{tool.model}</td>
							<td className="p-4 text-muted-foreground">{tool.collection}</td>
							<td className="p-4 text-muted-foreground">
								{tool.summary}
								{[
									"elmo",
									"profound",
									"peec-ai",
									"otterly-ai",
									"promptwatch",
								].includes(tool.slug) && (
									<span className="mt-2 block">
										<Link
											className="font-medium text-foreground underline underline-offset-4"
											href={`/compare/oneglanse-vs-${tool.slug}`}
										>
											Compare with OneGlanse
										</Link>
									</span>
								)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
