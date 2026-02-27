export interface WorkspaceLocation {
	country: string;
	countryName?: string | null;
	region?: string | null;
	regionName?: string | null;
}

export type CompetitorInput = {
	name: string;
	slug: string;
	domain: string;
};
