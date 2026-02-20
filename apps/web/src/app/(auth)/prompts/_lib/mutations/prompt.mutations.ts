import { api } from "@/trpc/react";

export function useStorePrompt() {
	return api.prompt.store.useMutation();
}
