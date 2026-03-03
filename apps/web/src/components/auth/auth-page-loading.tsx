import { Skeleton } from "@oneglanse/ui";
import { AuthPageShell } from "./auth-page-shell";

export function AuthPageLoading(): React.JSX.Element {
	return (
		<AuthPageShell>
			<div className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
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
		</AuthPageShell>
	);
}
