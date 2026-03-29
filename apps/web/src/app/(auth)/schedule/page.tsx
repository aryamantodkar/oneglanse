import { redirect } from "next/navigation";
import SchedulePageClient from "./schedule-page-client";

export default function SchedulePage({
	searchParams,
}: {
	searchParams?: { workspace?: string };
}) {
	const isSelfHosted = process.env.NEXT_PUBLIC_SELF_HOSTED === "true";
	if (!isSelfHosted) {
		const workspaceQuery = searchParams?.workspace
			? `?workspace=${encodeURIComponent(searchParams.workspace)}`
			: "";
		redirect(`/dashboard${workspaceQuery}`);
	}

	return <SchedulePageClient />;
}
