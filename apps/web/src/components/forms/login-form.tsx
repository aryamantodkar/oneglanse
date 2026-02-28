"use client";
import { authClient } from "@/lib/auth/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
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
import { cn } from "@oneglanse/utils";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { z } from "zod";

const formSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
});

export function LoginForm({
	className,
	...props
}: React.ComponentProps<"div">): React.JSX.Element {
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
		<div
			className={cn("ui-page-enter flex flex-col gap-6", className)}
			{...props}
		>
			<Card className="ui-list-item">
				<CardHeader className="text-center">
					<CardTitle className="text-xl">Welcome back</CardTitle>
					<CardDescription>Login with your Google account</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
							<div className="ui-stagger grid gap-6">
								<div className="flex flex-col gap-4">
									<Button
										variant="outline"
										className="w-full"
										type="button"
										onClick={signInWithGoogle}
									>
										<FcGoogle className="h-4 w-4" />
										Login with Google
									</Button>
								</div>
								<div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
									<span className="bg-card text-muted-foreground relative z-10 px-2">
										Or continue with
									</span>
								</div>
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
									<div className="grid gap-3">
										<div className="flex flex-col gap-2">
											<FormField
												control={form.control}
												name="password"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Password</FormLabel>
														<FormControl>
															<Input
																placeholder="*******"
																{...field}
																type="password"
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<a
												href="#"
												className="ml-auto text-sm underline-offset-4 hover:underline"
											>
												Forgot your password?
											</a>
										</div>
									</div>
									<Button type="submit" className="w-full" disabled={isLoading}>
										{isLoading ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											"Login"
										)}
									</Button>
								</div>
								<div className="text-center text-sm">
									Don&apos;t have an account?{" "}
									<Link href="/signup" className="underline underline-offset-4">
										Sign up
									</Link>
								</div>
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>
			<div className="text-muted-foreground *:[a]:hover:text-primary text-center text-xs text-balance *:[a]:underline *:[a]:underline-offset-4">
				By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
				and <a href="#">Privacy Policy</a>.
			</div>
		</div>
	);
}
