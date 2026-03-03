"use client";

import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@oneglanse/ui";
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
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				{children}
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					{footerActions}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
