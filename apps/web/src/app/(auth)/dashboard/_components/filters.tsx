import {
	Button,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Separator,
} from "@oneglanse/ui";
import {
	getFaviconUrls,
	getModelFavicon,
	modelSelectors,
} from "@oneglanse/utils";
import { Bot, FilterX } from "lucide-react";

export function DashboardFilters({
	brandName,
	brandDomain,
	modelFilter,
	setModelFilter,
	timeFilter,
	setTimeFilter,
}: {
	brandName: string;
	brandDomain: string;
	modelFilter: string;
	setModelFilter: (v: string) => void;
	timeFilter: "all" | "7d" | "14d" | "30d";
	setTimeFilter: (v: "all" | "7d" | "14d" | "30d") => void;
}) {
	const faviconUrls = getFaviconUrls(brandDomain);

	return (
		<div className="flex items-center gap-3">
			{/* Brand pill */}
			<div className="flex h-9 shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm transition-[transform,border-color,box-shadow] duration-200 ease-out hover:-translate-y-px hover:shadow-sm dark:border-gray-800 dark:bg-gray-950">
				{faviconUrls[0] && (
					<img
						src={faviconUrls[0]}
						alt=""
						className="h-4 w-4 rounded-sm"
						onError={(e) =>
							((e.target as HTMLImageElement).style.display = "none")
						}
					/>
				)}
				<span className="font-medium text-gray-900 dark:text-gray-100">
					{brandName}
				</span>
			</div>

			<Select value={modelFilter} onValueChange={setModelFilter}>
				<SelectTrigger className="h-9 w-44 shrink-0 rounded-lg border border-gray-200 bg-white text-sm dark:border-gray-800 dark:bg-gray-950">
					<SelectValue placeholder="Select Model" />
				</SelectTrigger>
				<SelectContent className="z-[9999]">
					{modelSelectors.map(({ value, label }) => (
						<SelectItem key={value} value={value}>
							<div className="flex items-center gap-2">
								{value === "All Models" ? (
									<Bot className="h-4 w-4 text-muted-foreground" />
								) : (
									<img
										src={getModelFavicon(value)}
										alt={value}
										className="h-4 w-4 rounded-sm"
									/>
								)}
								<span>{label}</span>
							</div>
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Select
				value={timeFilter}
				onValueChange={(v) => setTimeFilter(v as "all" | "7d" | "14d" | "30d")}
			>
				<SelectTrigger className="h-9 w-40 text-sm">
					<SelectValue placeholder="Time range" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All time</SelectItem>
					<SelectItem value="7d">Last 7 days</SelectItem>
					<SelectItem value="14d">Last 14 days</SelectItem>
					<SelectItem value="30d">Last 30 days</SelectItem>
				</SelectContent>
			</Select>

			{(modelFilter !== "All Models" || timeFilter !== "all") && (
				<>
					<Separator orientation="vertical" className="h-4" />
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setModelFilter("All Models");
							setTimeFilter("all");
						}}
						className="gap-2 text-gray-500 transition-[color,transform] duration-200 hover:text-gray-700"
					>
						<FilterX size={14} />
						Clear
					</Button>
				</>
			)}
		</div>
	);
}
