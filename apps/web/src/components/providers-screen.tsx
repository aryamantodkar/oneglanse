import { ProviderConnectionsPanel } from "@/components/provider-connections-panel";

const DEFAULT_PROVIDERS_TITLE = "Connect Providers";
const DEFAULT_PROVIDERS_DESCRIPTION =
	"Log in to any provider below, then close the browser window. Your auth is saved automatically, and you can continue as soon as one provider is active.";
const DEFAULT_PROVIDERS_HELPER_TEXT =
	"If Google OAuth keeps signing you into the same account, sign in to Gmail in this browser with the account you want to use first, then reconnect the provider.";

export function ProvidersScreen(props: {
	title?: string | null;
	description?: string | null;
	helperText?: string | null;
	nextHref?: string | null;
	showSetupNotice?: boolean;
	workspaceId?: string | null;
	showOnboardingActions?: boolean;
	watchForExternalUpdates?: boolean;
}) {
	const {
		title = DEFAULT_PROVIDERS_TITLE,
		description = DEFAULT_PROVIDERS_DESCRIPTION,
		helperText = DEFAULT_PROVIDERS_HELPER_TEXT,
		nextHref = null,
		showSetupNotice = true,
		workspaceId = null,
		showOnboardingActions = false,
		watchForExternalUpdates = false,
	} = props;

	return (
		<div className="flex min-h-full min-w-0 items-center justify-center overflow-x-hidden px-4 pt-5 pb-9 sm:px-8 sm:pt-7 sm:pb-11 lg:px-10">
			<div className="ui-stagger w-full max-w-4xl xl:max-w-5xl">
				<ProviderConnectionsPanel
					title={title}
					description={description}
					helperText={helperText}
					nextHref={nextHref}
					showSetupNotice={showSetupNotice}
					workspaceId={workspaceId}
					showOnboardingActions={showOnboardingActions}
					watchForExternalUpdates={watchForExternalUpdates}
				/>
			</div>
		</div>
	);
}
