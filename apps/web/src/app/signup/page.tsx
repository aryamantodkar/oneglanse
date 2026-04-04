import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { SignupForm } from "@/components/forms/signup-form";

export default function SignupPage() {
	return (
		<AuthPageShell subtitle="The only open-source platform to track, measure, and improve your brand’s visibility across AI and LLMs">
			<SignupForm />
		</AuthPageShell>
	);
}
