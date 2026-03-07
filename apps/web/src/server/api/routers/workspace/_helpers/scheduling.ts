import { ValidationError, toErrorMessage } from "@oneglanse/errors";
import { submitAgentJobGroup } from "@oneglanse/services";
import { CronExpressionParser } from "cron-parser";

export type ImmediateRunResult =
	| { status: "queued"; jobId: string }
	| { status: "empty" }
	| { status: "failed"; error: string };

export function parseCronExpressionOrThrow(cronExpression: string) {
	try {
		return CronExpressionParser.parse(cronExpression, {
			currentDate: new Date(),
		});
	} catch (err) {
		throw new ValidationError("Invalid cron expression", {
			cronExpression,
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

export async function submitImmediateRunWithRetry(args: {
	workspaceId: string;
	userId: string;
	maxAttempts?: number;
}): Promise<ImmediateRunResult> {
	const { workspaceId, userId, maxAttempts = 3 } = args;
	let lastError: unknown = null;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			const result = await submitAgentJobGroup({ workspaceId, userId });
			if (result.status === "empty") return { status: "empty" };
			return { status: "queued", jobId: result.jobGroupId };
		} catch (err) {
			lastError = err;
			console.error(
				`[workspace] immediate run submission failed (attempt ${attempt}/${maxAttempts}, workspace=${workspaceId}, user=${userId}):`,
				toErrorMessage(err),
			);
			if (attempt < maxAttempts) {
				await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
			}
		}
	}

	return {
		status: "failed",
		error: toErrorMessage(lastError),
	};
}
