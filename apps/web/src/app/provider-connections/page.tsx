"use client";

import { ProviderConnectionsPanel } from "@/components/provider-connections-panel";

export default function PublicProviderConnectionsPage() {
	return (
		<main className="mx-auto flex min-h-svh w-full max-w-4xl flex-col px-4 py-10 sm:px-6">
			<div className="mb-6">
				<h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
					Provider Connections
				</h1>
				<p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
					Use this standalone page on your local machine to capture provider
					sessions without running the full app flow. The same connection module
					is used inside the app whenever required provider auth is missing.
				</p>
			</div>

			<ProviderConnectionsPanel description="Capture each provider auth bundle locally, then let the runtime seed persistent Camoufox profiles from those saved sessions." />
		</main>
	);
}
