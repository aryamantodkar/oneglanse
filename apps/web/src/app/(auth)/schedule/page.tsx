import SchedulePageClient from "./schedule-page-client";

export default function SchedulePage() {
	const isSelfHosted = process.env.NEXT_PUBLIC_SELF_HOSTED === "true";
	return <SchedulePageClient isSelfHosted={isSelfHosted} />;
}
