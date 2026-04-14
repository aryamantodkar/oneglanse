import { ProviderConnectionsPanel } from "@/components/provider-connections-panel";
import { getPostProvidersContinuePath } from "@/lib/auth/redirect";
import { getWorkspace } from "@/lib/workspace/getWorkspace";
import { resolveAppMode } from "@oneglanse/types";

export default async function ProvidersPage({
	searchParams,
}: {
	searchParams?: Promise<{ next?: string }>;
}) {
	const appMode = resolveAppMode(process.env.ONEGLANSE_APP_MODE);

	let workspace = null;
	try {
		workspace = await getWorkspace();
	} catch {
		workspace = null;
	}
	const params = await searchParams;
	const nextHref = params?.next
		? getPostProvidersContinuePath({
				rawNext: params.next,
				workspaceId: workspace?.id ?? null,
			})
		: null;

	const description =
		appMode === "self-host"
			? "To reconnect providers with fresh sessions, run pnpm auth on your local machine. Sessions are uploaded to your VPS automatically."
			: "Log in to any provider below, then close the browser window. Auth is saved automatically and you can reconnect here any time.";

	return (
		<div className="web-centered-page">
			<div className="w-full max-w-5xl space-y-6">
				<div className="max-w-2xl space-y-1.5">
					<h1 className="text-xl font-semibold tracking-[-0.025em] text-gray-900 dark:text-gray-100">
						Providers
					</h1>
					<p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
						{description}
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
