import { GalleryVerticalEnd } from "lucide-react";
import type { ReactNode } from "react";

type AuthPageShellProps = {
	children: ReactNode;
};

export function AuthPageShell({
	children,
}: AuthPageShellProps): React.JSX.Element {
	return (
		<div className="flex min-h-svh min-w-0 flex-col items-center justify-center gap-6 overflow-x-hidden bg-muted p-4 sm:p-6 md:p-10">
			<div className="flex w-full min-w-0 max-w-sm flex-col gap-6">
				<a href="/" className="flex items-center gap-2 self-center font-medium">
					<div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
						<GalleryVerticalEnd className="size-4" />
					</div>
					OneGlanse
				</a>
				{children}
			</div>
		</div>
	);
}
