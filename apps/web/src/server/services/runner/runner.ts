import "server-only";

import { analysePromptsForWorkspace } from "../analysis/analysis";
import { runPromptsForWorkspace } from "../prompt/prompt";

export async function runPromptPipeline({ workspaceId, userId } : { workspaceId: string; userId: string }) {
    const llmResults = await runPromptsForWorkspace({ workspaceId, userId });
    // const promptAnalysis = await analysePromptsForWorkspace({ workspaceId, userId });

    return {
        llmResults,
        promptAnalysis: null
    }
}