import typography from "@tailwindcss/typography";
import type { Config } from "tailwindcss";

const config: Config = {
	darkMode: "class",
	content: [
		"./src/**/*.{ts,tsx}",
		"../../packages/ui/src/**/*.{ts,tsx}",
		"../../packages/ui/dist/**/*.{js,jsx}",
	],
	theme: {
		extend: {},
	},
	plugins: [typography],
};

export default config;
