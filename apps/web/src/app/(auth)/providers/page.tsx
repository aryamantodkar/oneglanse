import { ProviderConnectionsPanel } from "@/components/provider-connections-panel";
import { getPostProvidersContinuePath } from "@/lib/auth/redirect";
import { getWorkspace } from "@/lib/workspace/getWorkspace";
import {
	isInteractiveAuthAllowedInMode,
	resolveAppMode,
} from "@oneglanse/types";
import { redirect } from "next/navigation";

export default async function ProvidersPage({
	searchParams,
}: {
	searchParams?: Promise<{ next?: string }>;
}) {
	const appMode = resolveAppMode(process.env.ONEGLANSE_APP_MODE);
	if (!isInteractiveAuthAllowedInMode(appMode)) {
		redirect("/");
	}

	let workspace = null;
	try {
		workspace = await getWorkspace();
	} catch {
		workspace = null;
	}
	const params = await searchParams;
	const nextHref = getPostProvidersContinuePath({
		rawNext: params?.next,
		workspaceId: workspace?.id ?? null,
	});

	return (
		<div className="web-centered-page">
			<div className="w-full max-w-5xl space-y-6">
				<div className="max-w-2xl space-y-1.5">
					<h1 className="text-xl font-semibold tracking-[-0.025em] text-gray-900 dark:text-gray-100">
						Providers
					</h1>
					<p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
						Log in to any provider below, then close the browser window. Auth is
						saved automatically and you can reconnect here any time on a local
						run.
					</p>
				</div>

				<ProviderConnectionsPanel
					title={null}
					description={null}
					nextHref={nextHref}
				/>
			</div>
		</div>
	);
}
