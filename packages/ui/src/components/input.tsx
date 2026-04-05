import type * as React from "react";

import { cn } from "@oneglanse/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"file:text-foreground placeholder:text-gray-400 selection:bg-primary selection:text-primary-foreground h-11 w-full min-w-0 rounded-[24px] border border-transparent bg-white px-4.5 py-2 text-base text-gray-900 shadow-[0_16px_38px_-30px_rgba(15,23,42,0.24)] transition-[color,box-shadow,border-color,background-color] duration-200 ease-out outline-none hover:bg-stone-50/80 hover:shadow-[0_18px_42px_-30px_rgba(15,23,42,0.28)] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-transparent dark:bg-neutral-950 dark:text-gray-100 dark:placeholder:text-gray-500 dark:shadow-[0_16px_38px_-30px_rgba(0,0,0,0.5)] dark:hover:bg-neutral-900 dark:hover:shadow-[0_18px_42px_-30px_rgba(0,0,0,0.54)] md:text-sm",
				"aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
