export interface WorkspaceLocation {
	workspaceCountry: string;
	workspaceRegion?: string | null;
}

export type CompetitorInput = {
	name: string;
	slug: string;
	domain: string;
};
