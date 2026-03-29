import { redirect } from "next/navigation";
import SchedulePageClient from "./schedule-page-client";

export default async function SchedulePage({
	searchParams,
}: {
	searchParams?: Promise<{ workspace?: string }>;
}) {
	const isSelfHosted = process.env.NEXT_PUBLIC_SELF_HOSTED === "true";
	if (!isSelfHosted) {
		const params = await searchParams;
		const workspaceQuery = params?.workspace
			? `?workspace=${encodeURIComponent(params.workspace)}`
			: "";
		redirect(`/dashboard${workspaceQuery}`);
	}

	return <SchedulePageClient />;
}
