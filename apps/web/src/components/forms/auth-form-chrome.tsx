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
	"min-w-0 overflow-hidden rounded-[16px] border border-transparent bg-white py-0 shadow-[0_12px_34px_-24px_rgba(0,0,0,0.22)] dark:border-transparent dark:bg-neutral-950 dark:shadow-[0_14px_36px_-24px_rgba(0,0,0,0.58)]";

export const formPanelClassName =
	"rounded-[16px] border border-transparent bg-white shadow-[0_12px_34px_-24px_rgba(0,0,0,0.18)] dark:border-transparent dark:bg-neutral-950 dark:shadow-[0_14px_36px_-24px_rgba(0,0,0,0.5)]";

export const formFieldClassName =
	"h-11 rounded-full border border-transparent bg-white px-4.5 text-[#1d1d1f] shadow-[0_8px_24px_-18px_rgba(0,0,0,0.16)] placeholder:text-gray-400 dark:border-transparent dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500 dark:shadow-[0_10px_28px_-18px_rgba(0,0,0,0.38)]";

export const formTextareaClassName = `${formFieldClassName} min-h-[136px] py-3`;

export const formLabelClassName =
	"text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-700 dark:text-gray-300";

export const formPrimaryButtonClassName =
	"h-11 w-full rounded-full bg-[#0071e3] px-4.5 text-white shadow-[0_10px_30px_-18px_rgba(0,113,227,0.45)] hover:bg-[#0077ed] hover:shadow-[0_12px_32px_-18px_rgba(0,113,227,0.5)] dark:bg-[#0071e3] dark:text-white dark:shadow-[0_12px_32px_-18px_rgba(0,113,227,0.38)] dark:hover:bg-[#0077ed]";

export const formSecondaryButtonClassName =
	"h-11 rounded-full border border-[#0071e3] bg-transparent px-4.5 text-[#0071e3] shadow-none hover:bg-[#0071e3]/6 hover:text-[#0066cc] dark:border-[#2997ff] dark:bg-transparent dark:text-[#2997ff] dark:hover:bg-[#2997ff]/10 dark:hover:text-[#53adff]";

export const formToolbarButtonClassName =
	"inline-flex justify-center h-11 rounded-full border border-transparent bg-white px-4.5 text-sm text-[#1d1d1f] shadow-[0_8px_24px_-18px_rgba(0,0,0,0.16)] hover:bg-[#f5f5f7] hover:shadow-[0_10px_28px_-18px_rgba(0,0,0,0.2)] dark:border-transparent dark:bg-gray-950 dark:text-gray-200 dark:shadow-[0_10px_28px_-18px_rgba(0,0,0,0.38)] dark:hover:bg-gray-900";

export const formToolbarGhostButtonClassName =
	"inline-flex justify-center h-11 rounded-full border border-transparent bg-white px-4.5 text-sm text-gray-500 shadow-[0_8px_24px_-18px_rgba(0,0,0,0.14)] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] hover:shadow-[0_10px_28px_-18px_rgba(0,0,0,0.18)] dark:border-transparent dark:bg-gray-950 dark:text-gray-400 dark:shadow-[0_10px_28px_-18px_rgba(0,0,0,0.34)] dark:hover:bg-neutral-900 dark:hover:text-gray-100";

export const formToolbarSelectClassName =
	"h-11 rounded-full border border-transparent bg-white px-4.5 text-sm text-[#1d1d1f] shadow-[0_8px_24px_-18px_rgba(0,0,0,0.16)] hover:bg-[#f5f5f7] hover:shadow-[0_10px_28px_-18px_rgba(0,0,0,0.2)] dark:border-transparent dark:bg-gray-950 dark:text-gray-200 dark:shadow-[0_10px_28px_-18px_rgba(0,0,0,0.38)] dark:hover:bg-gray-900";

export const formHintClassName =
	"text-xs leading-5 text-gray-400 dark:text-gray-500";

export const formChipClassName =
	"max-w-full rounded-full border border-gray-200/80 bg-[#f5f5f7] px-4 py-2 text-left text-xs text-gray-700 transition hover:bg-white dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-950";

export const formDialogContentClassName =
	"overflow-hidden rounded-[16px] border border-transparent bg-white p-0 shadow-[0_12px_34px_-24px_rgba(0,0,0,0.22)] dark:border-transparent dark:bg-neutral-950 dark:shadow-[0_14px_36px_-24px_rgba(0,0,0,0.58)]";

export const formDialogHeaderClassName =
	"space-y-1.5 px-5 pt-5 pb-0 text-left sm:px-6 sm:pt-6";

export const formDialogBodyClassName = "grid gap-3.5 px-5 py-5 sm:px-6 sm:py-6";

export const formDialogFieldGroupClassName = "grid gap-2.5";

export const formDialogSupportCardClassName =
	"rounded-[14px] bg-[#f5f5f7] px-4 py-3 text-left shadow-[0_10px_24px_-20px_rgba(0,0,0,0.16)] dark:bg-neutral-900/80 dark:shadow-[0_12px_28px_-20px_rgba(0,0,0,0.38)]";

export const formDialogStickyTopClassName =
	"sticky top-0 z-10 border-b border-gray-100/80 bg-white/95 px-5 pt-5 pb-4 backdrop-blur-sm shadow-[0_10px_24px_-20px_rgba(0,0,0,0.14)] sm:px-6 sm:pt-6 dark:border-gray-800/80 dark:bg-neutral-950/95 dark:shadow-[0_12px_28px_-20px_rgba(0,0,0,0.38)]";

export const formDialogScrollBodyClassName =
	"flex-1 space-y-4 overflow-y-auto px-5 pt-4 pb-2 sm:px-6 sm:pt-5";

export const formResponseStickyShellClassName =
	"rounded-[16px] border border-transparent bg-white px-4 py-4 shadow-[0_12px_34px_-24px_rgba(0,0,0,0.18)] backdrop-blur-sm dark:bg-neutral-950 dark:shadow-[0_14px_36px_-24px_rgba(0,0,0,0.48)] sm:px-5 sm:py-5";

export const formDialogFooterClassName =
	"flex-col-reverse gap-2.5 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-end sm:px-6 dark:border-gray-900";

export const formSectionTitleClassName =
	"text-lg font-medium tracking-[-0.025em] text-gray-950 dark:text-gray-50";

export const formSectionDescriptionClassName =
	"text-sm leading-6 text-gray-500 dark:text-gray-400";

export const formResponsePreviewCardClassName =
	"rounded-[16px] border border-transparent bg-white px-5 py-5 shadow-[0_12px_34px_-24px_rgba(0,0,0,0.16)] transition-[box-shadow,background-color] duration-200 ease-out hover:shadow-[0_14px_36px_-24px_rgba(0,0,0,0.18)] dark:border-transparent dark:bg-neutral-950 dark:shadow-[0_14px_36px_-24px_rgba(0,0,0,0.46)] sm:px-6 sm:py-6";

export const formResponseMetricsPanelClassName =
	"rounded-[20px] bg-transparent px-1 py-1";

export const formSubtleActionClassName =
	"inline-flex items-center rounded-[20px] px-0 py-0 text-xs font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100";

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
