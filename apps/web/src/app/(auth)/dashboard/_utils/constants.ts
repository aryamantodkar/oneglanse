import { AlertCircle, Info } from "lucide-react";

const priorityColors: Record<string, string> = {
	critical: "bg-red-500",
	high: "bg-orange-500",
	medium: "bg-amber-500",
	low: "bg-blue-500",
};

const defaultSeverityStyle = {
	bg: "bg-blue-50 dark:bg-blue-950/30",
	border: "border-blue-200 dark:border-blue-900/50",
	text: "text-blue-700 dark:text-blue-300",
	dot: "bg-blue-500",
	icon: Info as typeof AlertCircle,
};

const severityStyles: Record<
	string,
	{
		bg: string;
		border: string;
		text: string;
		dot: string;
		icon: typeof AlertCircle;
	}
> = {
	critical: {
		bg: "bg-red-50 dark:bg-red-950/30",
		border: "border-red-200 dark:border-red-900/50",
		text: "text-red-700 dark:text-red-300",
		dot: "bg-red-500",
		icon: AlertCircle,
	},
	warning: {
		bg: "bg-amber-50 dark:bg-amber-950/30",
		border: "border-amber-200 dark:border-amber-900/50",
		text: "text-amber-700 dark:text-amber-300",
		dot: "bg-amber-500",
		icon: AlertCircle,
	},
	info: {
		bg: "bg-blue-50 dark:bg-blue-950/30",
		border: "border-blue-200 dark:border-blue-900/50",
		text: "text-blue-700 dark:text-blue-300",
		dot: "bg-blue-500",
		icon: Info,
	},
};

const recTypeLabels: Record<string, string> = {
	top_pick: "Top Pick",
	strong_alternative: "Strong Alternative",
	conditional: "Conditional",
	mentioned_only: "Mentioned Only",
	discouraged: "Discouraged",
	not_mentioned: "Not Mentioned",
};

const recTypeColors: Record<string, string> = {
	top_pick:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
	strong_alternative:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
	conditional:
		"bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
	mentioned_only:
		"bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
	discouraged: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
	not_mentioned:
		"bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

export const pricingLabels: Record<string, string> = {
	premium: "Premium",
	mid_range: "Mid-range",
	budget: "Budget",
	free: "Free",
	not_mentioned: "Not mentioned",
};
