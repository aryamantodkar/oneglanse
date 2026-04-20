import { ProvidersScreen } from "@/components/providers-screen";
import { env } from "@/env";
import { getPostProvidersContinuePath } from "@/lib/auth/redirect";
import { getWorkspace } from "@/lib/workspace/getWorkspace";
import { resolveAppMode } from "@oneglanse/types";

export default async function ProvidersPage({
	searchParams,
}: {
	searchParams?: Promise<{ next?: string; onboarding?: string }>;
}) {
	let workspace = null;
	try {
		workspace = await getWorkspace();
	} catch {
		workspace = null;
	}
	const params = await searchParams;
	const showOnboardingActions = params?.onboarding === "1";
	const nextHref = showOnboardingActions
		? getPostProvidersContinuePath({
				rawNext: params?.next,
				workspaceId: workspace?.id ?? null,
			})
		: null;
	const appMode = resolveAppMode(env.NEXT_PUBLIC_ONEGLANSE_APP_MODE);
	const isSelfHost = appMode === "self-host";

	return (
		<ProvidersScreen
			description={isSelfHost ? null : undefined}
			nextHref={nextHref}
			showSetupNotice
			showOnboardingActions={showOnboardingActions}
			workspaceId={workspace?.id ?? null}
			watchForExternalUpdates={isSelfHost}
		/>
	);
}
