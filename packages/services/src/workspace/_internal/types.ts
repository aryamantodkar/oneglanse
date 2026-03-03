import type { Workspace } from "@oneglanse/db";

// Grouping type — workspaces scoped to an organization (uses db Workspace, stays in services)
export type OrganizationWorkspaceGroup = {
	organization: { id: string; name: string; slug: string | null };
	workspaces: Workspace[];
};

export type JoinByCodeOrganization = {
	id: string;
	name: string;
	slug: string | null;
};
export type JoinByCodeWorkspace = { id: string; name: string; slug: string };
