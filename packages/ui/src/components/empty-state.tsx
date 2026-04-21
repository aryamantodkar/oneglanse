import type { LucideIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@oneglanse/utils";

export const EMPTY_STATE_PANEL_WIDTH_CLASS =
	"w-full max-w-[19rem] sm:max-w-[20.5rem] xl:max-w-[22rem]";

export const EMPTY_STATE_PANEL_HEIGHT_CLASS =
	"min-h-[17.5rem] sm:min-h-[18.5rem] xl:min-h-[19.5rem]";

export const DASHBOARD_EMPTY_STATE_WIDTH_CLASS =
	"w-full max-w-[13.75rem] sm:max-w-[14.75rem] xl:max-w-[16rem]";

export const DASHBOARD_EMPTY_STATE_HEIGHT_CLASS =
	"min-h-[214px] sm:min-h-[228px] xl:min-h-[244px]";

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
	icon: _icon,
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
	const hasExamples = Boolean(examples && examples.length > 0);
	const hasHighlights = Boolean(highlights && highlights.length > 0);
	const hasSupportingContent = hasExamples || hasHighlights;

	return (
		<div className={cn("web-centered-state", className)}>
			<div
				className={cn(
					`${EMPTY_STATE_PANEL_WIDTH_CLASS} ${EMPTY_STATE_PANEL_HEIGHT_CLASS} flex flex-col rounded-[var(--app-radius)] border border-gray-100/80 bg-white px-4 py-3.5 text-center shadow-[0_20px_60px_-32px_rgba(15,23,42,0.18)] dark:border-gray-800 dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.55)] sm:px-4.5 sm:py-4.5 xl:rounded-[var(--app-radius)] xl:px-5.5 xl:py-5.5`,
					contentClassName,
				)}
			>
				<div
					className={cn(
						"flex flex-1 flex-col pt-1.5 sm:pt-2 xl:pt-2.5",
						!action && hasSupportingContent ? "justify-between" : undefined,
						!action && !hasSupportingContent ? "justify-center" : undefined,
					)}
				>
					<div className="pb-1.5 sm:pb-2 xl:pb-2.5">
						{eyebrow ? (
							<div className="mt-0 inline-flex items-center self-center rounded-[var(--app-radius)] border border-gray-200/80 bg-stone-50 px-3 py-1 text-[9px] font-medium uppercase tracking-[0.1em] text-gray-500 dark:border-gray-800 dark:bg-neutral-900 dark:text-gray-400 sm:text-[10px]">
								{eyebrow}
							</div>
						) : null}

						<h2
							className={cn(
								"text-[1rem] font-medium leading-[1.15] tracking-[-0.03em] text-gray-950 dark:text-gray-50 sm:text-[1.08rem] xl:text-[1.24rem]",
								eyebrow ? "mt-1.5 xl:mt-2" : "mt-0",
							)}
						>
							{title}
						</h2>
						<p className="mx-auto mt-1.5 max-w-xl text-[11px] leading-[1.4] text-gray-500 dark:text-gray-400 sm:text-[12px] sm:leading-[1.45] xl:mt-1.5 xl:text-[13px] xl:leading-[1.5]">
							{description}
						</p>
					</div>

					<div className="h-2 sm:h-2.5 xl:h-3" />

					{hasExamples ? (
						<div className="mx-auto w-full max-w-xl rounded-[var(--app-radius)] bg-stone-50/90 p-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:bg-neutral-900/80 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] sm:p-2.5 xl:rounded-[var(--app-radius)] xl:p-3">
							<p className="px-1 text-[10px] font-medium uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 sm:text-[11px]">
								{examplesLabel}
							</p>
							<div className="mt-1.5 grid gap-1.5 sm:mt-2 sm:gap-2 xl:mt-2.5">
								{examples?.map((example) => (
									<div
										key={typeof example === "string" ? example : example.label}
										className="flex items-center gap-2 rounded-[var(--app-radius)] bg-white/90 px-2.5 py-1.5 text-[11px] font-normal leading-[1.4] text-gray-700 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.22)] dark:bg-neutral-950 dark:text-gray-200 dark:shadow-[0_8px_24px_-20px_rgba(0,0,0,0.5)] sm:gap-2.5 sm:rounded-[var(--app-radius)] sm:text-[12px] sm:leading-[1.45]"
									>
										{typeof example !== "string" && example.icon ? (
											<example.icon className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
										) : null}
										<span className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
											{typeof example === "string" ? example : example.label}
										</span>
									</div>
								))}
							</div>
						</div>
					) : null}

					{hasHighlights ? (
						<div className="mx-auto max-w-lg text-left">
							{highlights?.map((item) => (
								<div
									key={item}
									className="flex items-start gap-2 border-gray-200/70 px-1 py-1.5 text-[11px] text-gray-600 dark:border-gray-800 dark:text-gray-300 sm:py-2 sm:text-[12px]"
								>
									<span className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-[var(--app-radius)] bg-gray-400 dark:bg-gray-500" />
									<span className="leading-[1.4] sm:leading-[1.45]">{item}</span>
								</div>
							))}
						</div>
					) : null}
				</div>

				{action ? (
					<div className="mt-3 flex min-h-9 items-center justify-center sm:mt-3.5 sm:min-h-10 xl:mt-4 xl:min-h-11">
						{action}
					</div>
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
