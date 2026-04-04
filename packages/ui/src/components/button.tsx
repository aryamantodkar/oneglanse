"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@oneglanse/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[24px] border border-transparent text-sm font-medium shadow-none transition-[box-shadow,background-color,color,border-color,opacity,transform] duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:translate-y-px motion-reduce:transition-none",
	{
		variants: {
			variant: {
				default:
					"bg-gray-950 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200",
				destructive:
					"bg-red-600 text-white hover:bg-red-700 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-red-600 dark:hover:bg-red-500",
				outline:
					"border-gray-200/80 bg-white text-gray-700 hover:bg-stone-50 hover:text-gray-900 dark:border-gray-800 dark:bg-neutral-950 dark:text-gray-200 dark:hover:bg-gray-900",
				secondary:
					"border-gray-200/70 bg-stone-100 text-gray-800 hover:bg-stone-200 dark:border-gray-800 dark:bg-neutral-900 dark:text-gray-200 dark:hover:bg-neutral-800",
				ghost:
					"shadow-none hover:bg-stone-100 hover:text-gray-900 dark:hover:bg-neutral-900 dark:hover:text-gray-100",
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
