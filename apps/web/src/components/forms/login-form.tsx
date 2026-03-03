"use client";
import { AuthFormChrome } from "@/components/forms/auth-form-chrome";
import { PasswordField } from "@/components/forms/password-field";
import { authClient } from "@/lib/auth/auth-client";
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
import { useRouter } from "next/navigation";
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
	const [isLoading, setIsLoading] = useState(false);

	const signInWithGoogle = async () => {
		await authClient.signIn.social({
			provider: "google",
			callbackURL: "/",
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

		try {
			await authClient.signIn.email({
				email: values.email,
				password: values.password,
			});
			toast.success("Signed in successfully!");
			router.push("/");
		} catch (err) {
			toast.error("Failed to sign in!");
		}

		setIsLoading(false);
	}

	return (
		<AuthFormChrome
			title="Welcome back"
			description="Login with your Google account"
			googleLabel="Login with Google"
			switchText="Don't have an account?"
			switchLabel="Sign up"
			switchHref="/signup"
			onGoogleClick={signInWithGoogle}
			className={className}
			{...props}
		>
			<Form {...form}>
				<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
					<div className="grid gap-6">
						<div className="grid gap-3">
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Email</FormLabel>
										<FormControl>
											<Input placeholder="john@gmail.com" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<PasswordField control={form.control} name="password" />
						<Button type="submit" className="w-full" disabled={isLoading}>
							{isLoading ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								"Login"
							)}
						</Button>
					</div>
				</form>
			</Form>
		</AuthFormChrome>
	);
}
