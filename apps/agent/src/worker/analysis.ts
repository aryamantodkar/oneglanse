import { analysePromptsForWorkspace } from "@onescope/services";
import type { Provider } from "@onescope/types";
import { logger } from "../lib/utils/logger.js";

export function runAnalysisInBackground(args: {
	workspaceId: string;
	userId: string;
	provider: Provider;
	jobGroupId: string;
}) {
	const { workspaceId, userId, provider, jobGroupId } = args;
	void (async () => {
		try {
			logger.log(
				`${provider} done for job group ${jobGroupId}, starting analysis in background...`,
			);
			await analysePromptsForWorkspace({
				workspaceId,
				userId,
				analyzeAll: true,
			});
			logger.success(
				`Background analysis completed after ${provider} for job group ${jobGroupId}`,
			);
		} catch (err: any) {
			logger.error(
				`Background analysis failed after ${provider} for job group ${jobGroupId}:`,
				err?.message ?? err,
			);
		}
	})();
}
