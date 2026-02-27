import { Skeleton } from "@oneglanse/ui";

export default function Loading() {
	return (
		<div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<div className="flex items-center gap-2 self-center">
					<Skeleton className="h-6 w-6 rounded-md" />
					<Skeleton className="h-4 w-24" />
				</div>
				<div className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
					<div className="space-y-2 text-center">
						<Skeleton className="mx-auto h-5 w-32" />
						<Skeleton className="mx-auto h-4 w-48" />
					</div>
					<div className="space-y-3">
						<Skeleton className="h-9 w-full" />
						<Skeleton className="h-9 w-full" />
						<Skeleton className="h-9 w-full" />
					</div>
				</div>
			</div>
		</div>
	);
}
