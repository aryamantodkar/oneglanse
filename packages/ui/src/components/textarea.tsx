import type * as React from "react";

import { cn } from "@oneglanse/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"placeholder:text-gray-400 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-[24px] border border-gray-200/80 bg-white px-4.5 py-3.5 text-base text-gray-900 shadow-none transition-[color,box-shadow,border-color,background-color] duration-200 ease-out outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-neutral-950 dark:text-gray-100 dark:placeholder:text-gray-500 md:text-sm",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
