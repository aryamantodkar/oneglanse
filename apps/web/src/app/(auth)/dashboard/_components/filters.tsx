import {
	Button,
	ProviderModelSelect,
	Separator,
	TimeRangeSelect,
} from "@oneglanse/ui";
import { getFaviconUrls } from "@oneglanse/utils";
import { FilterX } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

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
	const router = useRouter();
	const searchParams = useSearchParams();
	const faviconUrls = getFaviconUrls(brandDomain);

	const clearFilters = () => {
		const params = new URLSearchParams(searchParams.toString());
		params.delete("model");
		params.delete("time");

		setModelFilter("All Models");
		setTimeFilter("all");
		
		const query = params.toString();
		router.push(query ? `?${query}` : "?", { scroll: false });
	};

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

			<ProviderModelSelect
				value={modelFilter}
				onValueChange={setModelFilter}
				triggerClassName="h-9 w-44 shrink-0 rounded-lg border border-gray-200 bg-white text-sm dark:border-gray-800 dark:bg-gray-950"
				contentClassName="z-[9999]"
			/>

			<TimeRangeSelect
				value={timeFilter}
				onValueChange={setTimeFilter}
				triggerClassName="h-9 w-40 text-sm"
			/>

			{(modelFilter !== "All Models" || timeFilter !== "all") && (
				<>
					<Separator orientation="vertical" className="h-4" />
					<Button
						variant="ghost"
						size="sm"
						onClick={clearFilters}
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
