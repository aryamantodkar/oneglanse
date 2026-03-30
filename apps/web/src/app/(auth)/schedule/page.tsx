import { redirect } from "next/navigation";
import { canAccessScheduleInMode, resolveAppMode } from "@oneglanse/types";
import SchedulePageClient from "./schedule-page-client";

export default async function SchedulePage({
	searchParams,
}: {
	searchParams?: Promise<{ workspace?: string }>;
}) {
	const appMode = resolveAppMode(process.env.ONEGLANSE_APP_MODE);
	if (!canAccessScheduleInMode(appMode)) {
		const params = await searchParams;
		const workspaceQuery = params?.workspace
			? `?workspace=${encodeURIComponent(params.workspace)}`
			: "";
		redirect(`/dashboard${workspaceQuery}`);
	}

	return <SchedulePageClient />;
}
