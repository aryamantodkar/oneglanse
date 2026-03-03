import { submitAgentJobGroup } from "@oneglanse/services";

export type SubmitAgentRunResult =
	| { jobId: string; status: "queued" }
	| { jobId: null; status: "empty" };

export async function submitAgentRun(args: {
	workspaceId: string;
	userId: string;
}): Promise<SubmitAgentRunResult> {
	const result = await submitAgentJobGroup(args);

	if (result.status === "empty") {
		return { jobId: null, status: "empty" };
	}

	return { jobId: result.jobGroupId, status: "queued" };
}
