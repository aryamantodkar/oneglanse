import { formToolbarSelectClassName } from "@/components/forms/auth-form-chrome";
import { useSafeSearchParams } from "@/lib/navigation/use-safe-search-params";
import {
	Button,
	ProviderModelSelect,
	Separator,
	TimeRangeSelect,
} from "@oneglanse/ui";
import { cn, getFaviconUrls } from "@oneglanse/utils";
import { FilterX } from "lucide-react";
import { useRouter } from "next/navigation";

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
	const searchParams = useSafeSearchParams();
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
		<div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
			{/* Brand pill */}
			<div
				className={cn(
					formToolbarSelectClassName,
					"flex min-w-0 w-full max-w-full items-center gap-2 px-3.5 sm:w-auto sm:max-w-[240px]",
				)}
			>
				{faviconUrls[0] && (
					<img
						src={faviconUrls[0]}
						alt=""
						className="h-4 w-4 rounded-sm"
						onError={(e) => {
							(e.target as HTMLImageElement).style.display = "none";
						}}
					/>
				)}
				<span className="truncate font-medium text-gray-900 dark:text-gray-100">
					{brandName}
				</span>
			</div>

			<ProviderModelSelect
				value={modelFilter}
				onValueChange={setModelFilter}
				triggerClassName={`${formToolbarSelectClassName} w-full text-sm sm:w-auto`}
				contentClassName="z-[9999]"
			/>

			<TimeRangeSelect
				value={timeFilter}
				onValueChange={setTimeFilter}
				triggerClassName={`${formToolbarSelectClassName} w-full text-sm sm:w-auto`}
			/>

			{(modelFilter !== "All Models" || timeFilter !== "all") && (
				<>
					<Separator orientation="vertical" className="hidden h-4 sm:block" />
					<Button
						variant="ghost"
						size="sm"
						onClick={clearFilters}
						className="w-full gap-2 text-gray-500 transition-colors duration-200 hover:text-gray-700 sm:w-auto"
					>
						<FilterX size={14} />
						Clear
					</Button>
				</>
			)}
		</div>
	);
}
