import type * as React from "react";

import { cn } from "@oneglanse/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"placeholder:text-gray-400 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-[24px] border border-transparent bg-white px-4.5 py-3.5 text-base text-gray-900 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.24)] transition-[color,box-shadow,border-color,background-color] duration-200 ease-out outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-transparent dark:bg-neutral-950 dark:text-gray-100 dark:placeholder:text-gray-500 dark:shadow-[0_16px_38px_-30px_rgba(0,0,0,0.5)] md:text-sm",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
