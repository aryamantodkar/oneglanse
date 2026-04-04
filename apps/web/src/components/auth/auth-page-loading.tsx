import { Skeleton } from "@oneglanse/ui";
import { AuthPageShell } from "./auth-page-shell";

export function AuthPageLoading(): React.JSX.Element {
	return (
		<AuthPageShell>
			<div className="space-y-4 rounded-[28px] border border-gray-200/80 bg-white/92 p-7 shadow-[0_24px_70px_-28px_rgba(15,23,42,0.35)] dark:border-gray-800 dark:bg-gray-950/92">
				<div className="space-y-3">
					<Skeleton className="h-11 w-full rounded-xl" />
				</div>
				<div className="space-y-3">
					<Skeleton className="h-11 w-full rounded-xl" />
					<Skeleton className="h-11 w-full rounded-xl" />
					<Skeleton className="h-11 w-full rounded-xl" />
				</div>
			</div>
		</AuthPageShell>
	);
}
