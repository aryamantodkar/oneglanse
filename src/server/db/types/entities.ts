import type { Competitor } from "../types";

export interface WorkspaceLocation {
    workspaceCountry: string;
    workspaceRegion?: string | null;
}

export type CompetitorInput = {
    name: string;
    slug: string;
    domain: string;
};

export type CompetitorsResponse = {
    competitors: Competitor[];
};
  
  
  