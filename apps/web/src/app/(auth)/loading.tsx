import { Skeleton } from "@onescope/ui";

export default function Loading() {
	return (
		<div className="space-y-6 p-6">
			<div className="flex items-center justify-between">
				<Skeleton className="h-6 w-32" />
				<Skeleton className="h-8 w-20" />
			</div>
			<div className="space-y-3">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
				<Skeleton className="h-10 w-full" />
			</div>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{Array.from({ length: 6 }).map((_, idx) => (
					<Skeleton
						key={`card-skeleton-${idx}`}
						className="h-40 w-full rounded-xl"
					/>
				))}
			</div>
		</div>
	);
}
