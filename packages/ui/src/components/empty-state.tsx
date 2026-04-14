import type { LucideIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@oneglanse/utils";

export type EmptyStateExample =
	| string
	| {
			label: string;
			icon?: LucideIcon;
	  };

export type EmptyStatePanelProps = {
	icon?: LucideIcon;
	eyebrow?: string;
	title: string;
	description: string;
	examples?: EmptyStateExample[];
	examplesLabel?: string;
	highlights?: string[];
	action?: React.ReactNode;
	className?: string;
	contentClassName?: string;
};

type PresetEmptyStateProps = Omit<EmptyStatePanelProps, "eyebrow">;

export function EmptyStatePanel({
	icon: Icon,
	eyebrow,
	title,
	description,
	examples,
	examplesLabel = "Examples",
	highlights,
	action,
	className,
	contentClassName,
}: EmptyStatePanelProps) {
	return (
		<div className={cn("web-centered-state", className)}>
			<div
				className={cn(
					"max-h-[min(100%,calc(100dvh-8.5rem))] w-full max-w-[36rem] overflow-y-auto rounded-[28px] border border-gray-100/80 bg-white px-4 py-4 text-center shadow-[0_20px_60px_-32px_rgba(15,23,42,0.18)] dark:border-gray-800 dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.55)] sm:px-6 sm:py-6",
					contentClassName,
				)}
			>
				{Icon ? (
					<div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[18px] border border-gray-200/80 bg-linear-to-b from-white to-stone-100 text-gray-500 shadow-[0_14px_36px_-24px_rgba(15,23,42,0.2)] dark:border-gray-800 dark:from-neutral-900 dark:to-neutral-950 dark:text-gray-400 dark:shadow-[0_14px_36px_-24px_rgba(0,0,0,0.5)]">
						<Icon className="h-4.5 w-4.5" />
					</div>
				) : null}

				{eyebrow ? (
					<div
						className={cn(
							"inline-flex items-center rounded-full border border-gray-200/80 bg-stone-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500 dark:border-gray-800 dark:bg-neutral-900 dark:text-gray-400",
							Icon ? "mt-3" : "mt-0",
						)}
					>
						{eyebrow}
					</div>
				) : null}

				<h2
					className={cn(
						"text-lg font-semibold tracking-[-0.03em] text-gray-950 dark:text-gray-50 sm:text-[1.15rem]",
						eyebrow || Icon ? "mt-2.5" : "mt-0",
					)}
				>
					{title}
				</h2>
				<p className="mx-auto mt-2 max-w-xl text-sm leading-5 text-gray-500 dark:text-gray-400">
					{description}
				</p>

				{examples && examples.length > 0 ? (
					<div className="mx-auto mt-3.5 w-full max-w-xl rounded-[22px] bg-stone-50/90 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:bg-neutral-900/80 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
						<p className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
							{examplesLabel}
						</p>
						<div className="mt-2.5 grid gap-2.5">
							{examples.map((example) => (
								<div
									key={typeof example === "string" ? example : example.label}
									className="flex items-start gap-2.5 rounded-[16px] bg-white/90 px-3 py-2 text-sm font-medium leading-5 text-gray-700 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.22)] dark:bg-neutral-950 dark:text-gray-200 dark:shadow-[0_8px_24px_-20px_rgba(0,0,0,0.5)]"
								>
									{typeof example !== "string" && example.icon ? (
										<example.icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
									) : null}
									<span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
										{typeof example === "string" ? example : example.label}
									</span>
								</div>
							))}
						</div>
					</div>
				) : null}

				{highlights && highlights.length > 0 ? (
					<div className="mx-auto mt-4 max-w-lg text-left">
						{highlights.map((item) => (
							<div
								key={item}
								className="flex items-start gap-2 border-gray-200/70 px-1 py-2 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300"
							>
								<span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-gray-500" />
								<span className="leading-5">{item}</span>
							</div>
						))}
					</div>
				) : null}

				{action ? (
					<div className="mt-4 flex justify-center">{action}</div>
				) : null}
			</div>
		</div>
	);
}

export function WorkspaceRequiredState({
	icon,
	title = "Pick a workspace to unlock the view",
	description = "Choose a workspace from the sidebar to see the prompts, sources, and insights tied to that brand.",
	highlights,
	action,
	className,
	contentClassName,
}: PresetEmptyStateProps) {
	return (
		<PresetEmptyState
			eyebrow="Workspace required"
			icon={icon}
			title={title}
			description={description}
			highlights={highlights}
			action={action}
			className={className}
			contentClassName={contentClassName}
		/>
	);
}

export function TemporaryIssueState({
	icon,
	title,
	description,
	highlights,
	action,
	className,
	contentClassName,
}: PresetEmptyStateProps) {
	return (
		<PresetEmptyState
			eyebrow="Momentary interruption"
			icon={icon}
			title={title}
			description={description}
			highlights={highlights}
			action={action}
			className={className}
			contentClassName={contentClassName}
		/>
	);
}

function PresetEmptyState({
	eyebrow,
	icon,
	title,
	description,
	highlights,
	action,
	className,
	contentClassName,
}: EmptyStatePanelProps) {
	return (
		<EmptyStatePanel
			icon={icon}
			eyebrow={eyebrow}
			title={title}
			description={description}
			highlights={highlights}
			action={action}
			className={className}
			contentClassName={contentClassName}
		/>
	);
}
