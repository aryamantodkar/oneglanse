import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { SignupForm } from "@/components/forms/signup-form";

export default function SignupPage() {
	return (
		<AuthPageShell>
			<SignupForm />
		</AuthPageShell>
	);
}
