"use client";

import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@oneglanse/ui";
import { cn } from "@oneglanse/utils";
import Link from "next/link";
import type { ReactNode } from "react";
import { FcGoogle } from "react-icons/fc";

type AuthFormChromeProps = React.ComponentProps<"div"> & {
	title: string;
	description: string;
	googleLabel: string;
	switchText: string;
	switchLabel: string;
	switchHref: string;
	onGoogleClick: () => void | Promise<void>;
	children: ReactNode;
};

export function AuthFormChrome({
	title,
	description,
	googleLabel,
	switchText,
	switchLabel,
	switchHref,
	onGoogleClick,
	children,
	className,
	...props
}: AuthFormChromeProps): React.JSX.Element {
	return (
		<div
			className={cn("ui-page-enter flex flex-col gap-6", className)}
			{...props}
		>
			<Card className="ui-list-item">
				<CardHeader className="text-center">
					<CardTitle className="text-xl">{title}</CardTitle>
					<CardDescription>{description}</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="ui-stagger grid gap-6">
						<div className="flex flex-col gap-4">
							<Button
								variant="outline"
								className="w-full"
								type="button"
								onClick={onGoogleClick}
							>
								<FcGoogle className="h-4 w-4" />
								{googleLabel}
							</Button>
						</div>
						<div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-border after:border-t">
							<span className="relative z-10 bg-card px-2 text-muted-foreground">
								Or continue with
							</span>
						</div>
						{children}
						<div className="text-center text-sm">
							{switchText}{" "}
							<Link href={switchHref} className="underline underline-offset-4">
								{switchLabel}
							</Link>
						</div>
					</div>
				</CardContent>
			</Card>
			<div className="text-balance text-center text-muted-foreground text-xs *:[a]:underline *:[a]:underline-offset-4 *:[a]:hover:text-primary">
				By clicking continue, you agree to our{" "}
				<a href="/terms">Terms of Service</a> and{" "}
				<a href="/privacy">Privacy Policy</a>.
			</div>
		</div>
	);
}
