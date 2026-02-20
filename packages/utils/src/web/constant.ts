import { PROVIDER_LIST } from "@onescope/types";
import { PROVIDERS } from "../agent/providers.js";

export const modelSelectors = [
	{ value: "All Models", label: "All Models" },
	...PROVIDER_LIST.map((p) => ({ value: p, label: PROVIDERS[p].displayName })),
];
