import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
	return (
		<AuthPageShell>
			<LoginForm />
		</AuthPageShell>
	);
}
