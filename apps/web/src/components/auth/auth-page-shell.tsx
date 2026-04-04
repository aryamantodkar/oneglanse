import type { ReactNode } from "react";

type AuthPageShellProps = {
	children: ReactNode;
	subtitle?: string;
};

export function AuthPageShell({
	children,
	subtitle,
}: AuthPageShellProps): React.JSX.Element {
	return (
		<div className="flex min-h-svh min-w-0 items-center justify-center overflow-hidden bg-stone-50 px-4 py-6 dark:bg-neutral-950 sm:px-6 sm:py-8 md:px-8">
			<div className="flex w-full min-w-0 max-w-md flex-col gap-6 sm:gap-8">
				<div className="space-y-2.5 text-center sm:space-y-3">
					<div className="text-[1.9rem] font-semibold tracking-[-0.06em] text-gray-950 sm:text-[2.4rem] dark:text-gray-50">
						OneGlanse
					</div>
					{subtitle ? (
						<div className="flex justify-center">
							<p className="text-center text-sm text-gray-600 dark:text-gray-300">
								{subtitle}
							</p>
						</div>
					) : null}
				</div>
				{children}
			</div>
		</div>
	);
}
