import { ProviderConnectionsPanel } from "@/components/provider-connections-panel";
import { getPostProvidersContinuePath } from "@/lib/auth/redirect";
import { getWorkspace } from "@/lib/workspace/getWorkspace";
import { isInteractiveAuthAllowedInMode, resolveAppMode } from "@oneglanse/types";
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
		<div className="mx-auto flex w-full max-w-5xl flex-col px-2 py-4 sm:px-4">
			<div className="mb-12 max-w-3xl">
				<h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-gray-900 dark:text-gray-100">
					Providers
				</h1>
				<p className="mt-3 text-base leading-7 text-gray-500 dark:text-gray-400">
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
	);
}
