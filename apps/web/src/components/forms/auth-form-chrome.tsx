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

export const formSurfaceClassName =
	"min-w-0 overflow-hidden rounded-[24px] border-0 bg-white py-0 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.22)] dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.65)]";

export const formPanelClassName =
	"rounded-[24px] border-0 bg-white shadow-[0_20px_60px_-32px_rgba(15,23,42,0.18)] dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.55)]";

export const formFieldClassName =
	"h-11 rounded-[24px] border-gray-200/80 bg-white px-4.5 text-gray-900 shadow-none placeholder:text-gray-400 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500";

export const formTextareaClassName = `${formFieldClassName} min-h-[136px] py-3`;

export const formLabelClassName =
	"text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-700 dark:text-gray-300";

export const formPrimaryButtonClassName =
	"h-11 w-full rounded-[24px] bg-gray-950 px-4.5 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200";

export const formSecondaryButtonClassName =
	"h-11 rounded-[24px] border-gray-200/80 bg-white px-4.5 text-gray-700 shadow-none hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900";

export const formToolbarButtonClassName =
	"inline-flex min-w-[10rem] justify-center h-11 rounded-[24px] border-gray-200/80 bg-white px-4.5 text-sm text-gray-700 shadow-none hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900";

export const formToolbarGhostButtonClassName =
	"inline-flex min-w-[8.5rem] justify-center h-11 rounded-[24px] px-4.5 text-sm text-gray-500 shadow-none hover:bg-stone-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-neutral-900 dark:hover:text-gray-100";

export const formToolbarSelectClassName =
	"h-11 min-w-[10rem] rounded-[24px] border-gray-200/80 bg-white px-4.5 text-sm text-gray-700 shadow-none hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900";

export const formHintClassName =
	"text-xs leading-5 text-gray-400 dark:text-gray-500";

export const formChipClassName =
	"max-w-full rounded-[24px] border border-gray-200/80 bg-stone-50 px-4 py-2 text-left text-xs text-gray-700 transition hover:border-gray-300 hover:bg-white dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-700 dark:hover:bg-gray-950";

export const formDialogContentClassName =
	"overflow-hidden rounded-[24px] border-0 bg-white p-0 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.22)] dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.65)]";

export const formDialogHeaderClassName =
	"space-y-1.5 px-5 pt-5 pb-0 text-left sm:px-6 sm:pt-6";

export const formDialogBodyClassName = "grid gap-3.5 px-5 py-5 sm:px-6 sm:py-6";

export const formDialogFooterClassName =
	"flex-col-reverse gap-2.5 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 dark:border-gray-900";

export const authFieldClassName = formFieldClassName;
export const authLabelClassName = formLabelClassName;
export const authSubmitButtonClassName = formPrimaryButtonClassName;

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
			<Card className={formSurfaceClassName}>
				{title || description ? (
					<CardHeader className="space-y-1.5 px-5 pt-5 pb-0 text-left sm:px-6 sm:pt-6">
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
				<CardContent className="px-5 py-5 sm:px-6 sm:py-6">
					<div className="grid min-w-0 gap-4 sm:gap-5">
						<Button
							variant="outline"
							className={cn(
								formSecondaryButtonClassName,
								"w-full justify-center text-sm font-medium",
							)}
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
