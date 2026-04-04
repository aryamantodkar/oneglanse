"use client";

import {
	authFieldClassName,
	authLabelClassName,
} from "@/components/forms/auth-form-chrome";
import {
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Input,
} from "@oneglanse/ui";
import type { Control, FieldValues, Path } from "react-hook-form";

type PasswordFieldProps<T extends FieldValues> = {
	control: Control<T>;
	name: Path<T>;
	forgotHref?: string;
	autoComplete?: string;
};

export function PasswordField<T extends FieldValues>({
	control,
	name,
	forgotHref = "/forgot-password",
	autoComplete = "current-password",
}: PasswordFieldProps<T>): React.JSX.Element {
	return (
		<div className="grid gap-2.5">
			<div className="flex flex-col gap-1.5">
				<FormField
					control={control}
					name={name}
					render={({ field }) => (
						<FormItem>
							<FormLabel className={authLabelClassName}>Password</FormLabel>
							<FormControl>
								<Input
									type="password"
									autoComplete={autoComplete}
									placeholder="Enter your password"
									className={authFieldClassName}
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<a
					href={forgotHref}
					className="ml-auto text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					Forgot your password?
				</a>
			</div>
		</div>
	);
}
