"use client";

import type { Workspace } from "@oneglanse/db";
import { createContext, useContext } from "react";

type WorkspaceContextValue = {
	workspace: Workspace | null;
	userEmail: string;
};

const WorkspaceContext = createContext<WorkspaceContextValue>({
	workspace: null,
	userEmail: "",
});

export function WorkspaceProvider({
	workspace,
	userEmail,
	children,
}: {
	workspace: Workspace | null;
	userEmail: string;
	children: React.ReactNode;
}) {
	return (
		<WorkspaceContext.Provider value={{ workspace, userEmail }}>
			{children}
		</WorkspaceContext.Provider>
	);
}

export function useLayoutWorkspace(): Workspace | null {
	return useContext(WorkspaceContext).workspace;
}

export function useLayoutUserEmail(): string {
	return useContext(WorkspaceContext).userEmail;
}
