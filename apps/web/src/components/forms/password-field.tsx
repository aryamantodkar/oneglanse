"use client";

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
};

export function PasswordField<T extends FieldValues>({
	control,
	name,
	forgotHref = "/forgot-password",
}: PasswordFieldProps<T>): React.JSX.Element {
	return (
		<div className="grid gap-3">
			<div className="flex flex-col gap-2">
				<FormField
					control={control}
					name={name}
					render={({ field }) => (
						<FormItem>
							<FormLabel>Password</FormLabel>
							<FormControl>
								<Input placeholder="*******" {...field} type="password" />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<a
					href={forgotHref}
					className="ml-auto text-sm underline-offset-4 hover:underline"
				>
					Forgot your password?
				</a>
			</div>
		</div>
	);
}
