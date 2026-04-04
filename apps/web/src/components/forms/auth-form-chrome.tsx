"use client";

import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@oneglanse/ui";
import { cn } from "@oneglanse/utils";
import Link from "next/link";
import type { ReactNode } from "react";
import { FcGoogle } from "react-icons/fc";

type AuthFormChromeProps = React.ComponentProps<"div"> & {
	title?: string;
	description?: string;
	googleLabel: string;
	switchText: string;
	switchLabel: string;
	switchHref: string;
	onGoogleClick: () => void | Promise<void>;
	children: ReactNode;
};

export const authFieldClassName =
	"h-11 rounded-2xl border-gray-200/80 bg-white px-4 shadow-none focus-visible:border-gray-400 focus-visible:ring-gray-950/8 dark:border-gray-800 dark:bg-gray-950 dark:focus-visible:border-gray-700 dark:focus-visible:ring-white/10";

export const authLabelClassName =
	"text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";

export const authSubmitButtonClassName =
	"h-11 w-full rounded-2xl bg-gray-950 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200";

export function AuthFormChrome({
	title,
	description,
	googleLabel,
	switchText,
	switchLabel,
	switchHref,
	onGoogleClick,
	children,
	className,
	...props
}: AuthFormChromeProps): React.JSX.Element {
	return (
		<div className={cn("flex flex-col gap-4", className)} {...props}>
			<Card className="min-w-0 overflow-hidden rounded-[32px] border-0 bg-white py-0 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.22)] dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.65)]">
				{title || description ? (
					<CardHeader className="space-y-3 px-6 pt-6 pb-0 text-left sm:px-7 sm:space-y-4 sm:pt-8">
						<div className="space-y-1.5">
							{title ? (
								<CardTitle className="text-[1.75rem] tracking-[-0.04em]">
									{title}
								</CardTitle>
							) : null}
							{description ? (
								<CardDescription className="max-w-sm text-sm leading-6">
									{description}
								</CardDescription>
							) : null}
						</div>
					</CardHeader>
				) : null}
				<CardContent className="px-6 py-6 sm:px-7 sm:py-8">
					<div className="grid min-w-0 gap-6 sm:gap-7">
						<Button
							variant="outline"
							className="h-11 w-full justify-center rounded-2xl border-gray-200/80 bg-white text-sm font-medium shadow-none hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900"
							type="button"
							onClick={onGoogleClick}
						>
							<FcGoogle className="h-4 w-4" />
							{googleLabel}
						</Button>
						<div className="relative text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-border after:border-t">
							<span className="relative z-10 bg-white px-3 dark:bg-neutral-950">
								Or continue with
							</span>
						</div>
						{children}
						<div className="text-center text-sm text-muted-foreground">
							{switchText}{" "}
							<Link
								href={switchHref}
								className="font-medium text-foreground underline-offset-4 hover:underline"
							>
								{switchLabel}
							</Link>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
