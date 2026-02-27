import { api } from "@/trpc/react";

export function useStorePrompt(): any {
	return api.prompt.store.useMutation();
}
