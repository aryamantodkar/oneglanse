import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
	return (
		<AuthPageShell subtitle="The only open-source platform to track, measure, and improve your brand’s visibility across AI and LLMs">
			<LoginForm />
		</AuthPageShell>
	);
}
