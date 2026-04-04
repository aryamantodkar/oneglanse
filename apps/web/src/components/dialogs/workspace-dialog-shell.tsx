"use client";

import {
	formDialogBodyClassName,
	formDialogContentClassName,
	formDialogFooterClassName,
	formDialogHeaderClassName,
	formSecondaryButtonClassName,
} from "@/components/forms/auth-form-chrome";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@oneglanse/ui";
import { cn } from "@oneglanse/utils";
import type { ReactNode } from "react";

type WorkspaceDialogShellProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCloseReset: () => void;
	title: string;
	description: string;
	children: ReactNode;
	footerActions: ReactNode;
};

export function WorkspaceDialogShell({
	open,
	onOpenChange,
	onCloseReset,
	title,
	description,
	children,
	footerActions,
}: WorkspaceDialogShellProps): React.JSX.Element {
	return (
		<Dialog
			open={open}
			onOpenChange={(isOpen) => {
				if (!isOpen) onCloseReset();
				onOpenChange(isOpen);
			}}
		>
			<DialogContent className={formDialogContentClassName}>
				<DialogHeader className={formDialogHeaderClassName}>
					<DialogTitle className="text-[1.45rem] tracking-[-0.04em] text-gray-950 dark:text-gray-50">
						{title}
					</DialogTitle>
					<DialogDescription className="max-w-md text-sm leading-6 text-gray-500 dark:text-gray-400">
						{description}
					</DialogDescription>
				</DialogHeader>
				<div className={formDialogBodyClassName}>{children}</div>
				<DialogFooter className={formDialogFooterClassName}>
					<Button
						variant="outline"
						className={cn(formSecondaryButtonClassName, "w-full sm:w-auto")}
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					{footerActions}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
