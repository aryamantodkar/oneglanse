import { analysePromptsForWorkspace } from "../analysis/analysis";
import { fetchPromptResponsesForWorkspace } from "../prompt/prompt";

export async function runPromptPipeline({ workspaceId, userId } : { workspaceId: string; userId: string }) {
    const promptResponses = await fetchPromptResponsesForWorkspace({ workspaceId, userId });
    const promptAnalysis = await analysePromptsForWorkspace({ workspaceId, userId });

    return {
        promptResponses,
        promptAnalysis
    }
}