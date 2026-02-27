import type { DomainStats, SourceGroupResult } from "./sources.js";
import type { ModelResult } from "./agent.js";

export interface CreateWorkspaceForTenantArgs {
	name: string;
	slug: string;
	domain: string;
	tenantId: string;
	country: string;
	region?: string | null;
	userId: string;
}

export interface GetWorkspaceByIdArgs {
	workspaceId: string;
}

export interface GetWorkspacesForUserArgs {
	tenantId: string;
	userId: string;
}

export interface GetWorkspaceMembersWithUsersArgs {
	workspaceId: string;
}

export interface AddMemberToWorkspaceArgs {
	workspaceId: string;
	userId: string;
	role?: string;
}

export interface AddMemberToWorkspaceResult {
	workspaceId: string;
	userId: string;
	role: string;
}

export interface RemoveMemberFromWorkspaceArgs {
	workspaceId: string;
	userId: string;
}

export interface RemoveMemberFromWorkspaceResult {
	workspaceId: string;
	userId: string;
}

export interface GetAllWorkspacesForUserArgs {
	userId: string;
}

export interface StorePromptsForWorkspaceArgs {
	prompts: string[];
	workspaceId: string;
	userId: string;
}

export interface ConfigureSchedulerSecretsArgs {}

export interface ScheduleCronForPromptsArgs {
	workspaceId: string;
	userId: string;
	cronExpression: string;
}

export interface UnscheduleCronForPromptsArgs {
	workspaceId: string;
}

export interface StorePromptResponsesArgs {
	results: ModelResult;
	userId: string;
	workspaceId: string;
	promptRunAt: string;
}

export interface FetchPromptResponsesForWorkspaceArgs {
	workspaceId: string;
	userId: string;
}

export interface FetchPromptSourcesForWorkspaceArgs {
	workspaceId: string;
	userId: string;
}

export interface FetchPromptSourcesForWorkspaceResult {
	domain_stats: { combined: DomainStats[]; byModel: Record<string, DomainStats[]> };
	sourceStats: SourceGroupResult;
}

export interface FetchUserPromptsForWorkspaceArgs {
	workspaceId: string;
	userId: string;
}
