"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@oneglanse/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[24px] border text-sm font-medium transition-[box-shadow,background-color,color,border-color,opacity,transform] duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none aria-invalid:border-destructive active:translate-y-px motion-reduce:transition-none",
	{
		variants: {
			variant: {
				default:
					"border-transparent bg-gray-950 text-white shadow-[0_20px_48px_-26px_rgba(15,23,42,0.38)] hover:bg-gray-800 hover:shadow-[0_20px_48px_-22px_rgba(15,23,42,0.44)] dark:border-transparent dark:bg-white dark:text-gray-950 dark:shadow-[0_20px_48px_-26px_rgba(0,0,0,0.56)] dark:hover:bg-gray-200",
				destructive:
					"border-transparent bg-red-600 text-white shadow-[0_20px_48px_-26px_rgba(220,38,38,0.4)] hover:bg-red-700 hover:shadow-[0_20px_48px_-22px_rgba(220,38,38,0.46)] dark:border-transparent dark:bg-red-600 dark:shadow-[0_20px_48px_-26px_rgba(127,29,29,0.6)] dark:hover:bg-red-500",
				outline:
					"border border-transparent bg-white text-gray-700 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_18px_-14px_rgba(15,23,42,0.12)] hover:bg-stone-50 hover:text-gray-900 hover:shadow-[0_1px_2px_rgba(15,23,42,0.06),0_10px_22px_-14px_rgba(15,23,42,0.16)] dark:border-transparent dark:bg-neutral-950 dark:text-gray-200 dark:shadow-[0_1px_2px_rgba(0,0,0,0.14),0_10px_24px_-16px_rgba(0,0,0,0.4)] dark:hover:bg-gray-900",
				secondary:
					"border-transparent bg-stone-100 text-gray-800 shadow-[0_18px_44px_-28px_rgba(15,23,42,0.22)] hover:bg-stone-200 hover:shadow-[0_18px_44px_-24px_rgba(15,23,42,0.26)] dark:border-transparent dark:bg-neutral-900 dark:text-gray-200 dark:shadow-[0_18px_44px_-28px_rgba(0,0,0,0.48)] dark:hover:bg-neutral-800",
				ghost:
					"border border-transparent bg-white text-gray-600 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_16px_-14px_rgba(15,23,42,0.1)] hover:bg-stone-50 hover:text-gray-900 hover:shadow-[0_1px_2px_rgba(15,23,42,0.06),0_10px_20px_-14px_rgba(15,23,42,0.14)] dark:border-transparent dark:bg-neutral-950 dark:text-gray-300 dark:shadow-[0_1px_2px_rgba(0,0,0,0.14),0_10px_22px_-16px_rgba(0,0,0,0.36)] dark:hover:bg-neutral-900 dark:hover:text-gray-100",
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
