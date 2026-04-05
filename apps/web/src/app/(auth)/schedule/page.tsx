import { resolveAppMode } from "@oneglanse/types";
import SchedulePageClient from "./schedule-page-client";

export default async function SchedulePage({
	searchParams,
}: {
	searchParams?: Promise<{ workspace?: string }>;
}) {
	const appMode = resolveAppMode(process.env.ONEGLANSE_APP_MODE);
	const params = await searchParams;

	return (
		<SchedulePageClient appMode={appMode} workspaceId={params?.workspace} />
	);
}
