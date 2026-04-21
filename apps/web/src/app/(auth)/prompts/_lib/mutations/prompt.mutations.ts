import { api } from "@/trpc/react";

export function useStorePrompt() {
	const utils = api.useUtils();
	return api.prompt.store.useMutation({
		onSuccess: () => {
			void utils.prompt.fetchUserPrompts.invalidate();
		},
	});
}
