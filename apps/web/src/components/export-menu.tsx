"use client";

import { formToolbarButtonClassName } from "@/components/forms/auth-form-chrome";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@oneglanse/ui";
import { Download } from "lucide-react";

export function ExportMenu({
	onExportJson,
	onExportCsv,
	disabled = false,
	className,
}: {
	onExportJson: () => void;
	onExportCsv: () => void;
	disabled?: boolean;
	className?: string;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					className={
						className
							? `${formToolbarButtonClassName} gap-2 ${className}`
							: `${formToolbarButtonClassName} gap-2`
					}
					disabled={disabled}
				>
					<Download className="h-4 w-4" />
					Export
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={onExportJson}>Export JSON</DropdownMenuItem>
				<DropdownMenuItem onClick={onExportCsv}>Export CSV</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
