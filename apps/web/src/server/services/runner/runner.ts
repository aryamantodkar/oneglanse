import "server-only";

import { analysePromptsForWorkspace } from "@onescope/services";
import { runPromptsForWorkspace } from "@onescope/services";

export async function runPromptPipeline({ workspaceId, userId } : { workspaceId: string; userId: string }) {
    const llmResults = await runPromptsForWorkspace({ workspaceId, userId });
    // const promptAnalysis = await analysePromptsForWorkspace({ workspaceId, userId });

    return {
        llmResults,
        promptAnalysis: null
    }
}