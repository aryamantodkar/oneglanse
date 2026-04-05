"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@oneglanse/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border text-sm font-medium transition-[box-shadow,background-color,color,border-color,opacity,transform] duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none aria-invalid:border-destructive active:translate-y-px motion-reduce:transition-none",
	{
		variants: {
			variant: {
				default:
					"border-transparent bg-[#0071e3] text-white shadow-[0_10px_30px_-18px_rgba(0,113,227,0.45)] hover:bg-[#0077ed] hover:shadow-[0_12px_32px_-18px_rgba(0,113,227,0.5)] dark:bg-[#0071e3] dark:text-white dark:shadow-[0_12px_32px_-18px_rgba(0,113,227,0.38)] dark:hover:bg-[#0077ed]",
				destructive:
					"border-transparent bg-red-600 text-white shadow-[0_10px_28px_-18px_rgba(220,38,38,0.42)] hover:bg-red-700 hover:shadow-[0_12px_32px_-18px_rgba(220,38,38,0.48)] dark:border-transparent dark:bg-red-600 dark:shadow-[0_12px_32px_-18px_rgba(127,29,29,0.55)] dark:hover:bg-red-500",
				outline:
					"border border-[#0071e3] bg-transparent text-[#0071e3] shadow-none hover:bg-[#0071e3]/6 hover:text-[#0066cc] dark:border-[#2997ff] dark:text-[#2997ff] dark:hover:bg-[#2997ff]/10 dark:hover:text-[#53adff]",
				secondary:
					"border-transparent bg-[#1d1d1f] text-white shadow-[0_10px_28px_-18px_rgba(29,29,31,0.38)] hover:bg-black hover:shadow-[0_12px_32px_-18px_rgba(0,0,0,0.42)] dark:bg-white dark:text-[#1d1d1f] dark:shadow-[0_10px_30px_-18px_rgba(255,255,255,0.08)] dark:hover:bg-[#f5f5f7]",
				ghost:
					"border-transparent bg-white text-[#1d1d1f] shadow-[0_8px_24px_-18px_rgba(0,0,0,0.22)] hover:bg-[#f5f5f7] hover:text-black hover:shadow-[0_10px_28px_-18px_rgba(0,0,0,0.24)] dark:bg-[#1d1d1f] dark:text-white dark:shadow-[0_10px_28px_-18px_rgba(0,0,0,0.44)] dark:hover:bg-[#272729]",
				link: "text-primary underline-offset-4 hover:underline hover:translate-y-0",
			},
			size: {
				default: "h-11 px-4.5 py-2 has-[>svg]:px-3.5",
				sm: "h-10 gap-1.5 px-4 has-[>svg]:px-3.5",
				lg: "h-11 px-6 has-[>svg]:px-4.5",
				icon: "size-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
