"use client";
import { AuthFormChrome } from "@/components/forms/auth-form-chrome";
import {
	authFieldClassName,
	authLabelClassName,
	authSubmitButtonClassName,
} from "@/components/forms/auth-form-chrome";
import { PasswordField } from "@/components/forms/password-field";
import { authClient } from "@/lib/auth/auth-client";
import {
	getPostAuthProvidersPath,
	getSafeAuthRedirectPath,
} from "@/lib/auth/redirect";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	Button,
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Input,
	toast,
	useForm,
} from "@oneglanse/ui";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { z } from "zod";

const formSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
});

export function LoginForm({
	className,
	...props
}: React.ComponentProps<"div">) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [isLoading, setIsLoading] = useState(false);
	const rawNext = searchParams?.get("next");
	const redirectPath = getSafeAuthRedirectPath(rawNext);
	const postAuthRedirectPath = getPostAuthProvidersPath(rawNext);
	const signupHref =
		redirectPath === "/"
			? "/signup"
			: `/signup?next=${encodeURIComponent(redirectPath)}`;

	const signInWithGoogle = async () => {
		await authClient.signIn.social({
			provider: "google",
			callbackURL: postAuthRedirectPath,
		});
	};

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	async function onSubmit(values: z.infer<typeof formSchema>) {
		setIsLoading(true);

		const { error } = await authClient.signIn.email({
			email: values.email,
			password: values.password,
		});

		if (error) {
			toast.error(error.message ?? "Failed to sign in.");
		} else {
			toast.success("Signed in successfully!");
			router.push(postAuthRedirectPath);
		}

		setIsLoading(false);
	}

	return (
		<AuthFormChrome
			googleLabel="Continue with Google"
			switchText="Don't have an account?"
			switchLabel="Sign up"
			switchHref={signupHref}
			onGoogleClick={signInWithGoogle}
			className={className}
			{...props}
		>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
					<div className="grid gap-4">
						<div className="grid gap-2.5">
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel className={authLabelClassName}>Email</FormLabel>
										<FormControl>
											<Input
												type="email"
												autoComplete="email"
												placeholder="name@company.com"
												className={authFieldClassName}
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<PasswordField control={form.control} name="password" />
						<Button
							type="submit"
							className={authSubmitButtonClassName}
							disabled={isLoading}
						>
							{isLoading ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								"Sign in"
							)}
						</Button>
					</div>
				</form>
			</Form>
		</AuthFormChrome>
	);
}
