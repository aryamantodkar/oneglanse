import { analysePromptsForWorkspace } from "@oneglanse/services";
import { toErrorMessage } from "@oneglanse/errors";
import type { Provider } from "@oneglanse/types";
import { createProviderLogger } from "@oneglanse/utils";

export function runAnalysisInBackground(args: {
	workspaceId: string;
	userId: string;
	provider: Provider;
	jobGroupId: string;
}): void {
	const { workspaceId, userId, provider, jobGroupId } = args;
	const plog = createProviderLogger(provider);
	void (async () => {
		try {
			plog.log(`done for job group ${jobGroupId}, starting analysis in background...`);
			await analysePromptsForWorkspace({
				workspaceId,
				analyzeAll: true,
			});
			plog.success(`Background analysis completed for job group ${jobGroupId}`);
		} catch (err) {
			plog.error(
				`Background analysis failed for job group ${jobGroupId}:`,
				toErrorMessage(err),
			);
		}
	})();
}
