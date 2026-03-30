"use client";

import { ProviderConnectionsPanel } from "@/components/provider-connections-panel";

export default function ConnectionsPage() {
	return (
		<div className="web-page-panel max-w-4xl">
			<div className="mb-6">
				<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
					Connect Providers
				</h1>
				<p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
					Sign in once with each provider group to create the portable auth
					bundles that seed persistent Camoufox runtime profiles. The same
					connection module is also available at{" "}
					<code>/provider-connections</code> for isolated local auth capture.
				</p>
			</div>

			<ProviderConnectionsPanel description="Connect each provider group below. Google covers both Gemini and Google Search domains in one shared auth state." />
		</div>
	);
}
