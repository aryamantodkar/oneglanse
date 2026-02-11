"use client";

import React from "react";
import type { AnalysisRecord, BrandAnalysisResult } from "@onescope/types";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	Separator,
	Skeleton,
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@onescope/ui";
import {
	filterAnalysisRecords,
	formatDate,
	getDomain,
	getFaviconUrls,
	getModelFavicon,
	modelSelectors,
} from "@onescope/utils";
import {
	AlertCircle,
	Award,
	BarChart3,
	Bot,
	Building2,
	CheckCircle2,
	ChevronDown,
	ExternalLink,
	FilterX,
	Globe,
	Info,
	Shield,
	Sparkles,
	Target,
	TrendingUp,
	Users,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
	useFetchAnalysedPrompts,
	usePromptSources,
} from "../prompts/_lib/queries/prompt.queries";

// ─── Helper Functions ────────────────────────────────────────────────────────

function severityRank(s: string): number {
	return s === "critical" ? 3 : s === "warning" ? 2 : 1;
}

function priorityRank(p: string): number {
	return p === "critical" ? 4 : p === "high" ? 3 : p === "medium" ? 2 : 1;
}

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

const pricingLabels: Record<string, string> = {
	premium: "Premium",
	mid_range: "Mid-range",
	budget: "Budget",
	free: "Free",
	not_mentioned: "Not mentioned",
};

function getSentimentColor(score: number) {
	if (score >= 60)
		return {
			text: "text-emerald-600 dark:text-emerald-400",
			bg: "bg-emerald-500",
		};
	if (score >= 40)
		return { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500" };
	return { text: "text-red-600 dark:text-red-400", bg: "bg-red-500" };
}

function getGeoScoreColor(score: number) {
	if (score >= 60) return "#22c55e";
	if (score >= 30) return "#f59e0b";
	return "#ef4444";
}

// ─── Leaf Visualization Components ───────────────────────────────────────────

function HorizontalBar({
	value,
	maxValue = 100,
	colorClass = "bg-blue-500",
}: {
	value: number;
	maxValue?: number;
	colorClass?: string;
}) {
	const widthPercent = Math.min((value / maxValue) * 100, 100);
	return (
		<div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
			<div
				className={`h-full rounded-full transition-all duration-700 ease-out ${colorClass}`}
				style={{ width: `${widthPercent}%` }}
			/>
		</div>
	);
}

function PillTag({
	label,
	className = "",
}: { label: string; className?: string }) {
	return (
		<span
			className={`inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700 text-xs dark:bg-gray-800 dark:text-gray-300 ${className}`}
		>
			{label}
		</span>
	);
}

function StatCard({
	label,
	value,
	subtitle,
	icon: Icon,
	favicon,
}: {
	label: string;
	value: string | number;
	subtitle?: string;
	icon: typeof TrendingUp;
	favicon?: string | null;
}) {
	return (
		<div className="flex flex-col gap-1 rounded-xl border border-gray-100 bg-card p-4 dark:border-gray-800">
			<div className="mb-1 flex items-center gap-2">
				{favicon ? (
					<img
						src={favicon}
						alt=""
						className="h-3.5 w-3.5 rounded-sm"
						onError={(e) => {
							(e.target as HTMLImageElement).style.display = "none";
						}}
					/>
				) : (
					<Icon className="h-3.5 w-3.5 text-muted-foreground" />
				)}
				<span className="font-medium text-muted-foreground text-xs">
					{label}
				</span>
			</div>
			<span className="font-bold text-2xl tracking-tight">{value}</span>
			{subtitle && (
				<span className="text-muted-foreground text-xs">{subtitle}</span>
			)}
		</div>
	);
}

// ─── Trend Line Components ────────────────────────────────────────────────────

// ─── State Components ────────────────────────────────────────────────────────

function DashboardSkeleton() {
	return (
		<div className="min-h-screen">
			<div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
				{/* Header */}
				<div>
					<Skeleton className="mb-2 h-7 w-56" />
					<Skeleton className="h-4 w-80" />
				</div>
				{/* Filters */}
				<div className="flex gap-3">
					<Skeleton className="h-9 w-44 rounded-lg" />
					<Skeleton className="h-9 w-40 rounded-lg" />
				</div>
				{/* Hero gauge */}
				<Skeleton className="h-56 rounded-xl" />
				{/* 2x2 metric grid */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Skeleton className="h-36 rounded-xl" />
					<Skeleton className="h-36 rounded-xl" />
					<Skeleton className="h-36 rounded-xl" />
					<Skeleton className="h-36 rounded-xl" />
				</div>
				{/* Stats row */}
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					<Skeleton className="h-24 rounded-xl" />
					<Skeleton className="h-24 rounded-xl" />
					<Skeleton className="h-24 rounded-xl" />
					<Skeleton className="h-24 rounded-xl" />
				</div>
				{/* Competitive landscape */}
				<Skeleton className="h-64 rounded-xl" />
				{/* Sentiment + Perception */}
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<Skeleton className="h-56 rounded-xl" />
					<Skeleton className="h-56 rounded-xl" />
				</div>
				{/* Sources */}
				<Skeleton className="h-48 rounded-xl" />
				{/* Table */}
				<Skeleton className="h-64 rounded-xl" />
			</div>
		</div>
	);
}

function NoWorkspaceState() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="flex flex-col items-center px-6 text-center">
				<div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
					<Building2 className="h-6 w-6 text-gray-400 dark:text-gray-500" />
				</div>
				<h2 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
					Select a workspace
				</h2>
				<p className="mt-2 max-w-sm text-gray-500 text-sm dark:text-gray-400">
					Choose a workspace from the sidebar to view your AI visibility
					dashboard.
				</p>
			</div>
		</div>
	);
}

function EmptyState() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="flex flex-col items-center px-6 text-center">
				<div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
					<BarChart3 className="h-6 w-6 text-gray-400 dark:text-gray-500" />
				</div>
				<h2 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
					No data yet
				</h2>
				<p className="mt-2 max-w-sm text-gray-500 text-sm dark:text-gray-400">
					Start tracking your brand&apos;s AI visibility by adding prompts and
					running agents from the Prompts page.
				</p>
			</div>
		</div>
	);
}

function NoAnalysisState() {
	return (
		<div className="flex min-h-screen items-center justify-center">
			<div className="flex flex-col items-center px-6 text-center">
				<div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
					<Sparkles className="h-6 w-6 text-gray-400 dark:text-gray-500" />
				</div>
				<h2 className="font-semibold text-gray-900 text-lg dark:text-gray-100">
					Analysis pending
				</h2>
				<p className="mt-2 max-w-sm text-gray-500 text-sm dark:text-gray-400">
					Your responses haven&apos;t been analyzed yet. Run analysis from the
					Prompts page to populate your dashboard.
				</p>
			</div>
		</div>
	);
}

// ─── Section Components ──────────────────────────────────────────────────────

function DashboardFilters({
	modelFilter,
	setModelFilter,
	timeFilter,
	setTimeFilter,
}: {
	modelFilter: string;
	setModelFilter: (v: string) => void;
	timeFilter: "all" | "7d" | "14d" | "30d";
	setTimeFilter: (v: "all" | "7d" | "14d" | "30d") => void;
}) {
	return (
		<div className="flex items-center gap-3">
			<Select value={modelFilter} onValueChange={setModelFilter}>
				<SelectTrigger className="h-9 w-44 shrink-0 rounded-lg border border-gray-200 bg-white text-sm dark:border-gray-800 dark:bg-gray-950">
					<SelectValue placeholder="Select Model" />
				</SelectTrigger>
				<SelectContent className="z-[9999]">
					{modelSelectors.map(({ value, label }) => (
						<SelectItem key={value} value={value}>
							<div className="flex items-center gap-2">
								{value === "All Models" ? (
									<Bot className="h-4 w-4 text-muted-foreground" />
								) : (
									<img
										src={getModelFavicon(value)}
										alt={value}
										className="h-4 w-4 rounded-sm"
									/>
								)}
								<span>{label}</span>
							</div>
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Select
				value={timeFilter}
				onValueChange={(v) => setTimeFilter(v as "all" | "7d" | "14d" | "30d")}
			>
				<SelectTrigger className="h-9 w-40 text-sm">
					<SelectValue placeholder="Time range" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All time</SelectItem>
					<SelectItem value="7d">Last 7 days</SelectItem>
					<SelectItem value="14d">Last 14 days</SelectItem>
					<SelectItem value="30d">Last 30 days</SelectItem>
				</SelectContent>
			</Select>

			{(modelFilter !== "All Models" || timeFilter !== "all") && (
				<>
					<Separator orientation="vertical" className="h-4" />
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setModelFilter("All Models");
							setTimeFilter("all");
						}}
						className="gap-2 text-gray-500 hover:text-gray-700"
					>
						<FilterX size={14} />
						Clear
					</Button>
				</>
			)}
		</div>
	);
}

function MetricCardsGrid({
	avgRank,
	avgSentiment,
}: {
	avgRank: { position: number | null; total: number | null };
	avgSentiment: { score: number; label: string };
}) {
	const sentimentColor = getSentimentColor(avgSentiment.score);

	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
			{/* Rank Card */}
			<Card className="overflow-hidden">
				<CardContent className="p-5">
					<div className="mb-2 flex items-center gap-2">
						<div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950/30">
							<Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
						</div>
						<span className="font-medium text-gray-700 text-xs uppercase tracking-wider dark:text-gray-300">
							Rank Position
						</span>
					</div>
					{avgRank.position !== null ? (
						<>
							<div className="flex items-baseline gap-2">
								<span className="font-bold text-4xl tracking-tight">#{avgRank.position}</span>
								{avgRank.total !== null && (
									<span className="text-muted-foreground text-base">
										of {avgRank.total}
									</span>
								)}
							</div>
							<p className="mt-1.5 text-muted-foreground text-xs">
								Average Across All Queries
							</p>
						</>
					) : (
						<span className="text-muted-foreground text-sm italic">
							No Ranking Data
						</span>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function AggregateStatsRow({
	presenceRate,
	rank,
	topSource,
	topSourceFavicon,
	topCompetitor,
	topCompetitorFavicon,
}: {
	presenceRate: number;
	rank: number;
	topSource: string;
	topSourceFavicon?: string | null;
	topCompetitor: string;
	topCompetitorFavicon?: string | null;
}) {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<StatCard
				icon={Globe}
				label="Presence Rate"
				value={`${presenceRate}%`}
				subtitle="Prompts mentioning your brand"
			/>
			<StatCard
				icon={Award}
				label="Rank"
				value={`#${rank}`}
				subtitle="Avg rank across prompts"
			/>
			<StatCard
				icon={Globe}
				label="Top Source"
				value={topSource}
				subtitle="Most cited information source"
				favicon={topSourceFavicon}
			/>
			<StatCard
				icon={Users}
				label="Top Competitor"
				value={topCompetitor}
				subtitle="Most frequently appears with you"
				favicon={topCompetitorFavicon}
			/>
		</div>
	);
}

function CompetitiveLandscape({
	competitors,
	brandName,
	brandSentiment,
}: {
	competitors: {
		name: string;
		appearances: number;
		avgSentiment: number;
		avgRank: number | null;
		recCount: number;
		winsOver: string[];
		losesTo: string[];
	}[];
	brandName: string;
	brandSentiment: number;
}) {
	const [competitorSort, setCompetitorSort] = useState<'appearances' | 'sentiment' | 'rank'>('rank');

	// Sort competitors based on selected criteria
	const sortedCompetitors = useMemo(() => {
		const sorted = [...competitors];
		switch(competitorSort) {
			case 'appearances':
				return sorted.sort((a, b) => b.appearances - a.appearances);
			case 'sentiment':
				return sorted.sort((a, b) => b.avgSentiment - a.avgSentiment);
			case 'rank':
				return sorted.sort((a, b) => {
					if (a.avgRank === null) return 1;
					if (b.avgRank === null) return -1;
					// Primary sort by rank, secondary by appearances for tie-breaking
					if (a.avgRank === b.avgRank) {
						return b.appearances - a.appearances;
					}
					return a.avgRank - b.avgRank;
				});
			default:
				return sorted;
		}
	}, [competitors, competitorSort]);

	if (competitors.length === 0) return null;

	return (
		<Card className="border-gray-100 dark:border-gray-800">
			<CardHeader className="pb-4 px-5 pt-5">
				<div className="flex items-center justify-between">
					<CardTitle className="text-sm font-semibold">Competitors</CardTitle>
					<div className="flex gap-1">
						<button
							onClick={() => setCompetitorSort('rank')}
							className={`rounded px-2 py-1 text-xs transition-colors ${
								competitorSort === 'rank'
									? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
									: 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
							}`}
						>
							Rank
						</button>
						<button
							onClick={() => setCompetitorSort('sentiment')}
							className={`rounded px-2 py-1 text-xs transition-colors ${
								competitorSort === 'sentiment'
									? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
									: 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
							}`}
						>
							Sentiment
						</button>
						<button
							onClick={() => setCompetitorSort('appearances')}
							className={`rounded px-2 py-1 text-xs transition-colors ${
								competitorSort === 'appearances'
									? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
									: 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
							}`}
						>
							Frequency
						</button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="px-5 pb-5 pt-0">
				<div className="space-y-2">
					{sortedCompetitors.slice(0, 5).map((comp, idx) => (
						<div
							key={comp.name}
							className="flex items-center justify-between py-2.5"
						>
							<div className="flex items-center gap-3 flex-1 min-w-0">
								<span className="text-gray-400 text-xs font-medium w-6 shrink-0">
									{idx + 1}
								</span>
								<span className="font-medium text-sm truncate">
									{comp.name}
								</span>
							</div>
							<div className="flex items-center gap-4 shrink-0">
								{comp.avgRank !== null && (
									<div className="text-center min-w-[48px]">
										<div className="text-gray-900 text-sm font-semibold dark:text-gray-100">
											#{comp.avgRank}
										</div>
										<div className="text-[10px] text-gray-400">
											rank
										</div>
									</div>
								)}
								<div className="text-center min-w-[48px]">
									<div className={`text-sm font-semibold ${getSentimentColor(comp.avgSentiment).text}`}>
										{comp.avgSentiment}
									</div>
									<div className="text-[10px] text-gray-400">
										sentiment
									</div>
								</div>
								<div className="text-center min-w-[48px]">
									<div className="text-gray-900 text-sm font-semibold dark:text-gray-100">
										{comp.appearances}
									</div>
									<div className="text-[10px] text-gray-400">
										mentions
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function SentimentBreakdown({
	positives,
	negatives,
}: {
	positives: { text: string; count: number }[];
	negatives: { text: string; count: number }[];
}) {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-sm font-semibold">Sentiment</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Strengths */}
				<div>
					<div className="mb-2 flex items-center gap-2">
						<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
						<p className="font-medium text-emerald-700 text-xs dark:text-emerald-400">
							Strengths
						</p>
					</div>
					{positives.length > 0 ? (
						<ul className="space-y-1.5">
							{positives.slice(0, 3).map((item) => (
								<li key={item.text} className="flex items-start gap-2">
									<span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
									<span className="text-gray-800 text-xs leading-relaxed dark:text-gray-200">
										{item.text.charAt(0).toUpperCase() + item.text.slice(1)}
									</span>
								</li>
							))}
						</ul>
					) : (
						<p className="text-muted-foreground text-xs italic">
							No data
						</p>
					)}
				</div>

				{/* Areas for Improvement */}
				<div>
					<div className="mb-2 flex items-center gap-2">
						<AlertCircle className="h-3.5 w-3.5 text-amber-500" />
						<p className="font-medium text-amber-700 text-xs dark:text-amber-400">
							Concerns
						</p>
					</div>
					{negatives.length > 0 ? (
						<ul className="space-y-1.5">
							{negatives.slice(0, 3).map((item) => (
								<li key={item.text} className="flex items-start gap-2">
									<span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
									<span className="text-gray-800 text-xs leading-relaxed dark:text-gray-200">
										{item.text.charAt(0).toUpperCase() + item.text.slice(1)}
									</span>
								</li>
							))}
						</ul>
					) : (
						<p className="text-muted-foreground text-xs italic">
							No data
						</p>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function BrandPerceptionCard({
	bestKnownFor,
	pricingPerception,
	coreClaims,
	differentiators,
}: {
	bestKnownFor: string | null;
	pricingPerception: string;
	coreClaims: string[];
	differentiators: string[];
}) {
	return (
		<Card className="border-gray-100 dark:border-gray-800">
			<CardHeader className="pb-4 px-5 pt-5">
				<CardTitle className="text-sm font-semibold">AI Perception</CardTitle>
			</CardHeader>
			<CardContent className="px-5 pb-5 pt-0">
				<div className="space-y-4">
					{/* Best Known For */}
					{bestKnownFor && (
						<div>
							<p className="mb-1.5 text-gray-400 text-xs">
								Best Known For
							</p>
							<p className="font-medium text-gray-900 text-sm leading-relaxed dark:text-gray-100">
								{bestKnownFor.charAt(0).toUpperCase() + bestKnownFor.slice(1)}
							</p>
						</div>
					)}

					{/* Pricing */}
					<div>
						<p className="mb-1.5 text-gray-400 text-xs">
							Pricing
						</p>
						<span className="inline-flex items-center rounded px-2 py-1 bg-gray-100 text-gray-900 text-xs font-medium dark:bg-gray-800 dark:text-gray-100">
							{pricingLabels[pricingPerception] ?? pricingPerception}
						</span>
					</div>

					{/* Core Claims */}
					{coreClaims.length > 0 && (
						<div>
							<p className="mb-2 text-gray-400 text-xs">
								Key Claims
							</p>
							<ul className="space-y-1.5">
								{coreClaims.slice(0, 4).map((claim) => (
									<li key={claim} className="flex items-start gap-2">
										<span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
										<span className="text-gray-700 text-xs leading-relaxed dark:text-gray-300">
											{claim.charAt(0).toUpperCase() + claim.slice(1)}
										</span>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function TopSources({
	sources,
	totalRecords = 1,
}: {
	sources: {
		domain: string;
		favicon: string | null;
		citationCount: number;
		uniqueRecords: Set<string>;
		models: Set<string>;
	}[];
	totalRecords?: number;
}) {
	if (sources.length === 0) return null;

	return (
		<Card className="border-gray-100 dark:border-gray-800">
			<CardHeader className="pb-4 px-5 pt-5">
				<CardTitle className="text-sm font-semibold">Top Sources</CardTitle>
			</CardHeader>
			<CardContent className="px-5 pb-5 pt-0">
				<div className="space-y-2">
					{sources.slice(0, 5).map((source, idx) => {
						const faviconUrl =
							source.favicon || getFaviconUrls(source.domain, "")[0];
						const usagePercent = Math.round((source.uniqueRecords.size / totalRecords) * 100);

						return (
							<div key={source.domain} className="flex items-center justify-between py-2.5">
								<div className="flex items-center gap-3 flex-1 min-w-0">
									<span className="text-gray-400 text-xs font-medium w-6 shrink-0">
										{idx + 1}
									</span>
									{faviconUrl && (
										<img
											src={faviconUrl}
											alt=""
											className="h-4 w-4 rounded-sm shrink-0"
											onError={(e) => {
												(e.target as HTMLImageElement).style.display = "none";
											}}
										/>
									)}
									<span className="font-medium text-sm truncate">
										{source.domain}
									</span>
								</div>
								<div className="flex items-center gap-4 shrink-0">
									<div className="text-center min-w-[48px]">
										<div className="text-gray-900 text-sm font-semibold dark:text-gray-100">
											{usagePercent}%
										</div>
										<div className="text-[10px] text-gray-400">
											usage
										</div>
									</div>
									<div className="text-center min-w-[48px]">
										<div className="text-gray-900 text-sm font-semibold dark:text-gray-100">
											{source.citationCount}
										</div>
										<div className="text-[10px] text-gray-400">
											citations
										</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}

function RiskAlerts({
	risks,
}: {
	risks: { type: string; severity: string; detail: string; count: number }[];
}) {
	if (risks.length === 0) return null;

	return (
		<Card className="border-gray-100 dark:border-gray-800">
			<CardHeader className="pb-4 px-5 pt-5">
				<CardTitle className="flex items-center gap-2 text-sm font-semibold">
					<Shield className="h-3.5 w-3.5" />
					Risk Alerts
				</CardTitle>
			</CardHeader>
			<CardContent className="px-5 pb-5 pt-0">
				<div className="space-y-3">
					{risks.map((risk, i) => {
						const style = severityStyles[risk.severity] ?? defaultSeverityStyle;
						const Icon = style.icon;
						return (
							<div
								key={i}
								className="flex items-start gap-3 py-2"
							>
								<Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style.text}`} />
								<div className="min-w-0 flex-1">
									<div className="mb-1 flex items-center gap-2">
										<span className={`font-semibold text-xs ${style.text}`}>
											{risk.severity.toUpperCase()}
										</span>
										{risk.count > 1 && (
											<span className="text-xs text-gray-400">
												({risk.count}×)
											</span>
										)}
									</div>
									<p className="text-sm text-gray-700 dark:text-gray-300">{risk.detail}</p>
								</div>
							</div>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}

function QueryLevelTable({
	groupedRecords,
	onSelectRecord,
}: {
	groupedRecords: Array<{
		prompt: string;
		records: AnalysisRecord[];
		avgScore: number;
		avgSentiment: number;
		bestRank: number | null;
		topRecType: string;
	}>;
	onSelectRecord: (prompt: string) => void;
}) {
	const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null);

	return (
		<Card className="border-gray-100 dark:border-gray-800">
			<CardHeader className="pb-4 px-5 pt-5">
				<CardTitle className="text-sm font-semibold">Query Performance</CardTitle>
			</CardHeader>
			<CardContent className="p-0">
				<div className="overflow-hidden rounded-b-xl">
					<Table className="min-w-full">
						<TableHeader>
							<TableRow className="border-gray-100 border-b bg-gray-50/70 dark:border-gray-800 dark:bg-gray-900/40">
								<TableHead className="px-4 py-3 text-left font-semibold text-gray-700 text-xs uppercase tracking-wider dark:text-gray-300">
									Query
								</TableHead>
								<TableHead className="px-4 py-3 text-center font-semibold text-gray-700 text-xs uppercase tracking-wider dark:text-gray-300">
									Models
								</TableHead>
								<TableHead className="px-4 py-3 text-center font-semibold text-gray-700 text-xs uppercase tracking-wider dark:text-gray-300">
									Avg Score
								</TableHead>
								<TableHead className="px-4 py-3 text-center font-semibold text-gray-700 text-xs uppercase tracking-wider dark:text-gray-300">
									Best Rank
								</TableHead>
								<TableHead className="px-4 py-3 text-center font-semibold text-gray-700 text-xs uppercase tracking-wider dark:text-gray-300">
									Avg Sentiment
								</TableHead>
								<TableHead className="px-4 py-3 text-center font-semibold text-gray-700 text-xs uppercase tracking-wider dark:text-gray-300">
									Top Rec.
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{groupedRecords.map((group) => {
								const isExpanded = expandedPrompt === group.prompt;
								const geoColor = getGeoScoreColor(group.avgScore);
								const sentimentColor = getSentimentColor(group.avgSentiment);

								return (
									<React.Fragment key={group.prompt}>
										<TableRow
											onClick={() =>
												setExpandedPrompt(isExpanded ? null : group.prompt)
											}
											className="cursor-pointer border-gray-100/50 border-b transition-colors hover:bg-gray-50 dark:border-gray-800/40 dark:hover:bg-gray-900/60"
										>
											<TableCell className="max-w-md px-4 py-4">
												<div className="flex items-center gap-2">
													<ChevronDown
														className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
													/>
													<span className="font-medium text-gray-900 text-sm dark:text-gray-100">
														{group.prompt}
													</span>
												</div>
											</TableCell>
											<TableCell className="px-4 py-4 text-center">
												<div className="flex items-center justify-center gap-1">
													{group.records.map((r) => (
														<img
															key={r.id}
															src={getModelFavicon(r.model_provider)}
															alt={r.model_provider}
															title={
																modelSelectors.find(
																	(m) => m.value === r.model_provider,
																)?.label
															}
															className="h-4 w-4 rounded-sm"
														/>
													))}
												</div>
											</TableCell>
											<TableCell className="px-4 py-4 text-center">
												<span
													className="font-bold text-sm"
													style={{ color: geoColor }}
												>
													{group.avgScore}
												</span>
											</TableCell>
											<TableCell className="px-4 py-4 text-center">
												<span className="font-medium text-gray-900 text-sm dark:text-gray-100">
													{group.bestRank ? `#${group.bestRank}` : "—"}
												</span>
											</TableCell>
											<TableCell className="px-4 py-4 text-center">
												<span
													className={`font-bold text-sm ${sentimentColor.text}`}
												>
													{group.avgSentiment}
												</span>
											</TableCell>
											<TableCell className="px-4 py-4 text-center">
												<span
													className={`inline-flex items-center rounded-md px-2.5 py-1 font-semibold text-xs ${recTypeColors[group.topRecType] ?? recTypeColors.not_mentioned}`}
												>
													{recTypeLabels[group.topRecType] ?? group.topRecType}
												</span>
											</TableCell>
										</TableRow>

										{/* Expanded Model Details */}
										{isExpanded && (
											<TableRow className="bg-gray-50/50 dark:bg-gray-900/20">
												<TableCell colSpan={6} className="px-8 py-4">
													<div className="space-y-2">
														<p className="mb-3 font-medium text-gray-700 text-xs uppercase tracking-wider dark:text-gray-300">
															Model-Specific Results
														</p>
														<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
															{group.records.map((record) => {
																const ba = record.brand_analysis!;
																const recColor = getGeoScoreColor(
																	ba.geoScore.overall,
																);
																const sentColor = getSentimentColor(
																	ba.sentiment.score,
																);

																return (
																	<button
																		key={record.id}
																		type="button"
																		onClick={(e) => {
																			e.stopPropagation();
																			onSelectRecord(record.prompt);
																		}}
																		className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left transition-colors hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900/50 dark:hover:border-gray-700"
																	>
																		<div className="flex items-center gap-3">
																			<img
																				src={getModelFavicon(
																					record.model_provider,
																				)}
																				alt={record.model_provider}
																				className="h-5 w-5 rounded-sm"
																			/>
																			<span className="font-medium text-gray-900 text-sm dark:text-gray-100">
																				{modelSelectors.find(
																					(m) => m.value === record.model_provider,
																				)?.label}
																			</span>
																		</div>
																		<div className="flex items-center gap-4">
																			<div className="text-right">
																				<span
																					className="block font-bold text-xs"
																					style={{ color: recColor }}
																				>
																					{ba.geoScore.overall} Score
																				</span>
																				<span
																					className={`block text-xs ${sentColor.text}`}
																				>
																					{ba.sentiment.score} Sentiment
																				</span>
																			</div>
																			<ExternalLink className="h-4 w-4 text-gray-400" />
																		</div>
																	</button>
																);
															})}
														</div>
													</div>
												</TableCell>
											</TableRow>
										)}
									</React.Fragment>
								);
							})}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}

function RecordDetailDialog({
	record,
	open,
	onClose,
}: {
	record: AnalysisRecord | null;
	open: boolean;
	onClose: () => void;
}) {
	if (!record || !record.brand_analysis) return null;

	const ba = record.brand_analysis!;
	const geoColor = getGeoScoreColor(ba.geoScore.overall);
	const sentimentColor = getSentimentColor(ba.sentiment.score);

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className="!max-w-[90vw] !w-[90vw] sm:!max-w-[70vw] sm:!w-[70vw] flex h-[85vh] flex-col rounded-2xl px-8 pb-8 sm:px-10 sm:pt-10 sm:pb-10">
				<DialogHeader className="pb-4">
					<DialogTitle className="font-semibold text-lg">
						{record.prompt}
					</DialogTitle>
					<DialogDescription>
						<div className="mt-1 flex items-center gap-3">
							<img
								src={getModelFavicon(record.model_provider)}
								alt={record.model_provider}
								className="h-4 w-4 rounded-sm"
							/>
							<span>
								{modelSelectors.find((m) => m.value === record.model_provider)
									?.label || record.model_provider}
							</span>
							<span className="text-gray-400">&middot;</span>
							<span>{formatDate(record.prompt_run_at)}</span>
						</div>
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 space-y-6 overflow-y-auto pr-2">
					{/* GEO Score + Key Metrics */}
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
						<div className="flex flex-col items-center rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
							<span className="mb-1 text-muted-foreground text-xs">
								GEO Score
							</span>
							<span className="font-bold text-2xl" style={{ color: geoColor }}>
								{ba.geoScore.overall}
							</span>
						</div>
						<div className="flex flex-col items-center rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
							<span className="mb-1 text-muted-foreground text-xs">Rank</span>
							<span className="font-bold text-2xl">
								{ba.position.rankPosition !== null
									? `#${ba.position.rankPosition}`
									: "—"}
							</span>
						</div>
						<div className="flex flex-col items-center rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
							<span className="mb-1 text-muted-foreground text-xs">
								Sentiment
							</span>
							<span className={`font-bold text-2xl ${sentimentColor.text}`}>
								{ba.sentiment.score}
							</span>
						</div>
						<div className="flex flex-col items-center rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
							<span className="mb-1 text-muted-foreground text-xs">
								Share of Voice
							</span>
							<span className="font-bold text-2xl">
								{ba.presence.shareOfVoice}%
							</span>
						</div>
					</div>

					{/* Verdict */}
					<div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
						<p className="mb-1 text-muted-foreground text-xs">Verdict</p>
						<p className="text-gray-700 text-sm dark:text-gray-300">
							{ba.geoScore.verdict}
						</p>
					</div>

					{/* Recommendation */}
					<div>
						<p className="mb-2 text-muted-foreground text-xs">Recommendation</p>
						<div className="flex flex-wrap items-center gap-3">
							<span
								className={`inline-flex items-center rounded-lg px-3 py-1 font-semibold text-sm ${recTypeColors[ba.recommendation.type] ?? ""}`}
							>
								{recTypeLabels[ba.recommendation.type] ??
									ba.recommendation.type}
							</span>
							{ba.recommendation.bestFor.map((tag) => (
								<PillTag key={tag} label={tag} />
							))}
						</div>
						{ba.recommendation.caveats.length > 0 && (
							<div className="mt-2 space-y-1">
								{ba.recommendation.caveats.map((caveat) => (
									<p
										key={caveat}
										className="text-muted-foreground text-xs italic"
									>
										{caveat}
									</p>
								))}
							</div>
						)}
					</div>

					{/* Sentiment Breakdown */}
					<div className="grid grid-cols-2 gap-4">
						<div>
							<p className="mb-2 font-medium text-emerald-600 text-xs dark:text-emerald-400">
								Positives
							</p>
							<ul className="space-y-1.5">
								{ba.sentiment.positives.map((p) => (
									<li
										key={p}
										className="flex items-start gap-1.5 text-gray-700 text-sm dark:text-gray-300"
									>
										<CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
										{p}
									</li>
								))}
							</ul>
						</div>
						<div>
							<p className="mb-2 font-medium text-amber-600 text-xs dark:text-amber-400">
								Negatives
							</p>
							<ul className="space-y-1.5">
								{ba.sentiment.negatives.map((n) => (
									<li
										key={n}
										className="flex items-start gap-1.5 text-gray-700 text-sm dark:text-gray-300"
									>
										<AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
										{n}
									</li>
								))}
							</ul>
						</div>
					</div>

					{/* Competitors */}
					{ba.competitors.length > 0 && (
						<div>
							<p className="mb-2 text-muted-foreground text-xs">Competitors</p>
							<div className="space-y-2">
								{ba.competitors.map((comp) => (
									<div
										key={comp.name}
										className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50"
									>
										<div className="flex items-center gap-3">
											<span className="font-medium text-sm">{comp.name}</span>
											{comp.rankPosition !== null && (
												<span className="text-muted-foreground text-xs">
													#{comp.rankPosition}
												</span>
											)}
											{comp.isRecommended && (
												<span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
													Recommended
												</span>
											)}
										</div>
										<span
											className={`font-medium text-sm ${getSentimentColor(comp.sentiment).text}`}
										>
											{comp.sentiment}
										</span>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Perception */}
					{ba.perception.bestKnownFor && (
						<div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/50">
							<p className="mb-1 text-muted-foreground text-xs">
								Best known for
							</p>
							<p className="font-medium text-sm">
								{ba.perception.bestKnownFor}
							</p>
							{ba.perception.differentiators.length > 0 && (
								<div className="mt-2 flex flex-wrap gap-1.5">
									{ba.perception.differentiators.map((d) => (
										<PillTag key={d} label={d} />
									))}
								</div>
							)}
						</div>
					)}

					{/* Risks */}
					{ba.risks.hasRisks && ba.risks.items.length > 0 && (
						<div>
							<p className="mb-2 text-muted-foreground text-xs">Risks</p>
							<div className="space-y-2">
								{ba.risks.items.map((risk, i) => {
									const style =
										severityStyles[risk.severity] ?? defaultSeverityStyle;
									return (
										<div
											key={i}
											className={`rounded-lg border p-3 ${style.bg} ${style.border}`}
										>
											<span
												className={`font-semibold text-xs uppercase ${style.text}`}
											>
												{risk.severity}
											</span>
											<p className={`mt-0.5 text-sm ${style.text}`}>
												{risk.detail}
											</p>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{/* Actions */}
					{ba.actions.length > 0 && (
						<div>
							<p className="mb-2 text-muted-foreground text-xs">Actions</p>
							<div className="space-y-2">
								{ba.actions.map((action, i) => (
									<div key={i} className="flex items-start gap-2">
										<span
											className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${priorityColors[action.priority] ?? "bg-gray-400"}`}
										/>
										<div>
											<span className="font-semibold text-[10px] text-muted-foreground uppercase">
												{action.priority}
											</span>
											<p className="text-gray-700 text-sm dark:text-gray-300">
												{action.recommendation}
											</p>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Sources */}
					{record.sources.length > 0 && (
						<div>
							<p className="mb-2 text-muted-foreground text-xs">Sources</p>
							<div className="flex flex-wrap gap-2">
								{record.sources.map((source, i) => {
									const favicon =
										source.favicon || getFaviconUrls(source.url, "")[0];
									return (
										<a
											key={`${source.url}-${i}`}
											href={source.url}
											target="_blank"
											rel="noopener noreferrer"
											className="inline-flex items-center gap-1.5 rounded-md border border-gray-200/60 bg-gray-50/50 px-2.5 py-1.5 text-[11px] text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-800/60 dark:bg-gray-900/50 dark:text-gray-400 dark:hover:bg-gray-800"
										>
											{favicon && (
												<img
													src={favicon}
													alt=""
													className="h-3.5 w-3.5 rounded-sm opacity-75"
												/>
											)}
											<span className="max-w-[200px] truncate">
												{source.title || getDomain(source.url)}
											</span>
										</a>
									);
								})}
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ─── Main Dashboard Component ────────────────────────────────────────────────

export default function Dashboard() {
	const searchParams = useSearchParams();
	const workspaceId = searchParams.get("workspace") ?? "";

	const { data: analysedPromptData, isLoading: isAnalysedPromptsLoading } =
		useFetchAnalysedPrompts(workspaceId);

	const { isLoading: isPromptSourcesLoading } = usePromptSources(workspaceId);

	const isLoading = isAnalysedPromptsLoading || isPromptSourcesLoading;

	// Filters
	const [modelFilter, setModelFilter] = useState("All Models");
	const [timeFilter, setTimeFilter] = useState<"all" | "7d" | "14d" | "30d">(
		"all",
	);

	// Table sorting

	// Record detail dialog
	const [selectedRecord, setSelectedRecord] = useState<AnalysisRecord | null>(
		null,
	);

	// ─── Data Extraction ─────────────────────────────────────────────────────

	const allRecords = useMemo<AnalysisRecord[]>(() => {
		const data = analysedPromptData?.data;
		if (!data) return [];
		// Handle both possible shapes: { records: [...] } or direct array
		if (Array.isArray(data)) return data;
		if (
			data &&
			typeof data === "object" &&
			"records" in data &&
			Array.isArray((data as any).records)
		) {
			return (data as any).records;
		}
		return [];
	}, [analysedPromptData]);

	const filteredRecords = useMemo(() => {
		return filterAnalysisRecords(allRecords, { modelFilter, timeFilter });
	}, [allRecords, modelFilter, timeFilter]);

	const analyzedRecords = useMemo(() => {
		return filteredRecords.filter(
			(r): r is AnalysisRecord & { brand_analysis: BrandAnalysisResult } =>
				!!r.is_analysed && !!r.brand_analysis,
		);
	}, [filteredRecords]);

	// ─── Aggregations ────────────────────────────────────────────────────────

	const brandName = useMemo(() => {
		const first = analyzedRecords.find(
			(r) => r.brand_analysis.metadata?.brandName,
		);
		return first?.brand_analysis.metadata?.brandName ?? "Your Brand";
	}, [analyzedRecords]);

	const avgGeoScore = useMemo(() => {
		if (analyzedRecords.length === 0) return { overall: 0, verdict: "" };
		const scores = analyzedRecords.map(
			(r) => r.brand_analysis.geoScore.overall,
		);
		const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
		const verdict = analyzedRecords[0]?.brand_analysis.geoScore.verdict ?? "";
		return { overall: avg, verdict };
	}, [analyzedRecords]);

	const avgRank = useMemo(() => {
		const withRank = analyzedRecords.filter(
			(r) => r.brand_analysis.position.rankPosition !== null,
		);
		if (withRank.length === 0) return { position: null, total: null };
		const avgPos = Math.round(
			withRank.reduce(
				(s, r) => s + r.brand_analysis.position.rankPosition!,
				0,
			) / withRank.length,
		);
		const withTotal = withRank.filter(
			(r) => r.brand_analysis.position.totalRanked !== null,
		);
		const avgTotal =
			withTotal.length > 0
				? Math.round(
						withTotal.reduce(
							(s, r) => s + r.brand_analysis.position.totalRanked!,
							0,
						) / withTotal.length,
					)
				: null;
		return { position: avgPos, total: avgTotal };
	}, [analyzedRecords]);

	const avgShareOfVoice = useMemo(() => {
		if (analyzedRecords.length === 0) return 0;
		return Math.round(
			analyzedRecords.reduce(
				(s, r) => s + r.brand_analysis.presence.shareOfVoice,
				0,
			) / analyzedRecords.length,
		);
	}, [analyzedRecords]);

	const avgProminence = useMemo(() => {
		if (analyzedRecords.length === 0) return "absent";
		const counts = new Map<string, number>();
		analyzedRecords.forEach((r) => {
			const p = r.brand_analysis.presence.prominence;
			counts.set(p, (counts.get(p) ?? 0) + 1);
		});
		return (
			[...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "absent"
		);
	}, [analyzedRecords]);

	const avgSentiment = useMemo(() => {
		if (analyzedRecords.length === 0)
			return { score: 0, label: "neutral" as const };
		const avg = Math.round(
			analyzedRecords.reduce(
				(s, r) => s + r.brand_analysis.sentiment.score,
				0,
			) / analyzedRecords.length,
		);
		const label =
			avg >= 80
				? "very_positive"
				: avg >= 60
					? "positive"
					: avg >= 40
						? "neutral"
						: avg >= 20
							? "negative"
							: "very_negative";
		return { score: avg, label };
	}, [analyzedRecords]);

	const topRecommendation = useMemo(() => {
		if (analyzedRecords.length === 0)
			return { type: "not_mentioned", bestFor: [] as string[] };
		const typeCounts = new Map<string, number>();
		const bestForCounts = new Map<string, number>();
		analyzedRecords.forEach((r) => {
			const type = r.brand_analysis.recommendation.type;
			typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
			r.brand_analysis.recommendation.bestFor.forEach((b) =>
				bestForCounts.set(b, (bestForCounts.get(b) ?? 0) + 1),
			);
		});
		const topType =
			[...typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
			"not_mentioned";
		const topBestFor = [...bestForCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([k]) => k);
		return { type: topType, bestFor: topBestFor };
	}, [analyzedRecords]);

	const aggregateStats = useMemo(() => {
		if (analyzedRecords.length === 0) {
			return { presenceRate: 0, winRate: 0, recRate: 0, topCompetitor: "N/A" };
		}
		const total = analyzedRecords.length;
		const mentioned = analyzedRecords.filter(
			(r) => r.brand_analysis.presence.mentioned,
		).length;
		const isTopPick = analyzedRecords.filter(
			(r) => r.brand_analysis.position.isTopPick,
		).length;
		const isRecommended = analyzedRecords.filter((r) =>
			["top_pick", "strong_alternative"].includes(
				r.brand_analysis.recommendation.type,
			),
		).length;

		const competitorCounts = new Map<string, number>();
		analyzedRecords.forEach((r) => {
			r.brand_analysis.competitors.forEach((c) => {
				competitorCounts.set(c.name, (competitorCounts.get(c.name) ?? 0) + 1);
			});
		});
		const topCompetitor =
			[...competitorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
			"N/A";

		return {
			presenceRate: Math.round((mentioned / total) * 100),
			winRate: Math.round((isTopPick / total) * 100),
			recRate: Math.round((isRecommended / total) * 100),
			topCompetitor,
		};
	}, [analyzedRecords]);

	const competitorData = useMemo(() => {
		const map = new Map<
			string,
			{
				name: string;
				appearances: number;
				sentimentSum: number;
				rankSum: number;
				rankCount: number;
				recCount: number;
				winsOver: Map<string, number>;
				losesTo: Map<string, number>;
			}
		>();

		analyzedRecords.forEach((r) => {
			r.brand_analysis.competitors.forEach((c) => {
				const existing = map.get(c.name) ?? {
					name: c.name,
					appearances: 0,
					sentimentSum: 0,
					rankSum: 0,
					rankCount: 0,
					recCount: 0,
					winsOver: new Map<string, number>(),
					losesTo: new Map<string, number>(),
				};
				existing.appearances += 1;
				existing.sentimentSum += c.sentiment;
				if (c.rankPosition !== null) {
					existing.rankSum += c.rankPosition;
					existing.rankCount += 1;
				}
				if (c.isRecommended) existing.recCount += 1;
				c.winsOver.forEach((w) =>
					existing.winsOver.set(w, (existing.winsOver.get(w) ?? 0) + 1),
				);
				c.losesTo.forEach((l) =>
					existing.losesTo.set(l, (existing.losesTo.get(l) ?? 0) + 1),
				);
				map.set(c.name, existing);
			});
		});

		return [...map.values()]
			.map((c) => ({
				name: c.name,
				appearances: c.appearances,
				avgSentiment: Math.round(c.sentimentSum / c.appearances),
				avgRank: c.rankCount > 0 ? Math.round(c.rankSum / c.rankCount) : null,
				recCount: c.recCount,
				winsOver: [...c.winsOver.entries()]
					.sort((a, b) => b[1] - a[1])
					.map(([k]) => k),
				losesTo: [...c.losesTo.entries()]
					.sort((a, b) => b[1] - a[1])
					.map(([k]) => k),
			}))
			.sort((a, b) => b.appearances - a.appearances);
	}, [analyzedRecords]);

	const sentimentBreakdown = useMemo(() => {
		const positiveCounts = new Map<string, number>();
		const negativeCounts = new Map<string, number>();
		analyzedRecords.forEach((r) => {
			r.brand_analysis.sentiment.positives.forEach((p) =>
				positiveCounts.set(p, (positiveCounts.get(p) ?? 0) + 1),
			);
			r.brand_analysis.sentiment.negatives.forEach((n) =>
				negativeCounts.set(n, (negativeCounts.get(n) ?? 0) + 1),
			);
		});
		return {
			positives: [...positiveCounts.entries()]
				.sort((a, b) => b[1] - a[1])
				.map(([text, count]) => ({ text, count })),
			negatives: [...negativeCounts.entries()]
				.sort((a, b) => b[1] - a[1])
				.map(([text, count]) => ({ text, count })),
		};
	}, [analyzedRecords]);

	const brandPerception = useMemo(() => {
		const bestKnownForCounts = new Map<string, number>();
		const pricingCounts = new Map<string, number>();
		const claimCounts = new Map<string, number>();
		const diffCounts = new Map<string, number>();

		analyzedRecords.forEach((r) => {
			const p = r.brand_analysis.perception;
			if (p.bestKnownFor)
				bestKnownForCounts.set(
					p.bestKnownFor,
					(bestKnownForCounts.get(p.bestKnownFor) ?? 0) + 1,
				);
			pricingCounts.set(
				p.pricingPerception,
				(pricingCounts.get(p.pricingPerception) ?? 0) + 1,
			);
			p.coreClaims.forEach((c) =>
				claimCounts.set(c, (claimCounts.get(c) ?? 0) + 1),
			);
			p.differentiators.forEach((d) =>
				diffCounts.set(d, (diffCounts.get(d) ?? 0) + 1),
			);
		});

		return {
			bestKnownFor:
				[...bestKnownForCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
				null,
			pricingPerception:
				[...pricingCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
				"not_mentioned",
			coreClaims: [...claimCounts.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 8)
				.map(([t]) => t),
			differentiators: [...diffCounts.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, 8)
				.map(([t]) => t),
		};
	}, [analyzedRecords]);

	const sourcesIntelligence = useMemo(() => {
		const domainMap = new Map<
			string,
			{
				domain: string;
				favicon: string | null;
				citationCount: number;
				uniqueRecords: Set<string>;
				models: Set<string>;
				excerpts: { text: string; model: string }[];
				urls: Set<string>;
			}
		>();

		analyzedRecords.forEach((r) => {
			r.sources.forEach((s) => {
				const domain = s.domain || getDomain(s.url);
				if (!domain) return;
				const existing = domainMap.get(domain) ?? {
					domain,
					favicon: s.favicon ?? null,
					citationCount: 0,
					uniqueRecords: new Set<string>(),
					models: new Set<string>(),
					excerpts: [],
					urls: new Set<string>(),
				};
				existing.citationCount += 1;
				existing.uniqueRecords.add(r.id);
				existing.models.add(r.model_provider);
				existing.urls.add(s.url);
				if (s.cited_text) {
					existing.excerpts.push({
						text: s.cited_text,
						model: r.model_provider,
					});
				}
				domainMap.set(domain, existing);
			});
		});

		return [...domainMap.values()]
			.sort((a, b) => b.uniqueRecords.size - a.uniqueRecords.size)
			.slice(0, 15);
	}, [analyzedRecords]);

	const aggregatedRisks = useMemo(() => {
		const riskMap = new Map<
			string,
			{ type: string; severity: string; detail: string; count: number }
		>();
		analyzedRecords.forEach((r) => {
			if (!r.brand_analysis.risks.hasRisks) return;
			r.brand_analysis.risks.items.forEach((risk) => {
				const key = risk.detail.toLowerCase().trim();
				const existing = riskMap.get(key);
				if (
					!existing ||
					severityRank(risk.severity) > severityRank(existing.severity)
				) {
					riskMap.set(key, { ...risk, count: (existing?.count ?? 0) + 1 });
				} else if (existing) {
					existing.count += 1;
				}
			});
		});
		return [...riskMap.values()].sort((a, b) => {
			const sevDiff = severityRank(b.severity) - severityRank(a.severity);
			return sevDiff !== 0 ? sevDiff : b.count - a.count;
		});
	}, [analyzedRecords]);

	const groupedRecords = useMemo(() => {
		const groups = new Map<string, AnalysisRecord[]>();

		analyzedRecords.forEach((record) => {
			const prompt = record.prompt;
			if (!groups.has(prompt)) {
				groups.set(prompt, []);
			}
			groups.get(prompt)!.push(record);
		});

		return Array.from(groups.entries()).map(([prompt, records]) => {
			// Sort records within group by model provider
			const sortedGroupRecords = records.sort((a, b) =>
				a.model_provider.localeCompare(b.model_provider),
			);

			// Calculate aggregate metrics
			const avgScore = Math.round(
				sortedGroupRecords.reduce(
					(sum, r) => sum + r.brand_analysis!.geoScore.overall,
					0,
				) / sortedGroupRecords.length,
			);

			const avgSentiment = Math.round(
				sortedGroupRecords.reduce(
					(sum, r) => sum + r.brand_analysis!.sentiment.score,
					0,
				) / sortedGroupRecords.length,
			);

			const rankPositions = sortedGroupRecords
				.map((r) => r.brand_analysis!.position.rankPosition)
				.filter((r): r is number => r !== null);
			const bestRank = rankPositions.length > 0 ? Math.min(...rankPositions) : null;

			// Get best recommendation type (prioritize top_pick > strong_alternative > etc)
			const recTypeOrder = [
				"top_pick",
				"strong_alternative",
				"conditional",
				"mentioned_only",
				"discouraged",
				"not_mentioned",
			];
			const topRecType = sortedGroupRecords
				.map((r) => r.brand_analysis!.recommendation.type)
				.sort((a, b) => recTypeOrder.indexOf(a) - recTypeOrder.indexOf(b))[0]!;

			return {
				prompt,
				records: sortedGroupRecords,
				avgScore,
				avgSentiment,
				bestRank,
				topRecType,
			};
		});
	}, [analyzedRecords]);

	// ─── Conditional Renders ─────────────────────────────────────────────────

	if (!workspaceId) {
		return <NoWorkspaceState />;
	}

	if (isLoading) {
		return <DashboardSkeleton />;
	}

	if (allRecords.length === 0) {
		return <EmptyState />;
	}

	if (analyzedRecords.length === 0) {
		return <NoAnalysisState />;
	}

	// ─── Full Dashboard ──────────────────────────────────────────────────────

	return (
		<div className="min-h-screen">
			<div className="mx-auto w-full max-w-[95vw] xl:max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
				{/* Header */}
				<header>
					<h1 className="font-semibold text-gray-900 text-xl dark:text-gray-100">
						AI Visibility Dashboard
					</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Aggregate brand intelligence across {analyzedRecords.length} AI
						response{analyzedRecords.length !== 1 ? "s" : ""}
					</p>
				</header>

				{/* Filters */}
				<DashboardFilters
					modelFilter={modelFilter}
					setModelFilter={setModelFilter}
					timeFilter={timeFilter}
					setTimeFilter={setTimeFilter}
				/>


				{/* Aggregate Stats */}
				<AggregateStatsRow
					presenceRate={aggregateStats.presenceRate}
					rank={avgRank.position ?? 0}
					topSource={sourcesIntelligence[0]?.domain ?? 'N/A'}
					topSourceFavicon={
						sourcesIntelligence[0]?.domain
							? getFaviconUrls(sourcesIntelligence[0].domain, sourcesIntelligence[0].favicon ?? "")[0]
							: null
					}
					topCompetitor={aggregateStats.topCompetitor}
					topCompetitorFavicon={
						aggregateStats.topCompetitor !== 'N/A'
							? getFaviconUrls(
									aggregateStats.topCompetitor.toLowerCase().replace(/\s+/g, ''),
									''
								)[0]
							: null
					}
				/>

				{/* 3-Column Compact Row: Competitive Landscape + Top Sources + AI Perception */}
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					<CompetitiveLandscape
						competitors={competitorData}
						brandName={brandName}
						brandSentiment={avgSentiment.score}
					/>
					<TopSources sources={sourcesIntelligence} totalRecords={analyzedRecords.length} />
					<BrandPerceptionCard
						bestKnownFor={brandPerception.bestKnownFor}
						pricingPerception={brandPerception.pricingPerception}
						coreClaims={brandPerception.coreClaims}
						differentiators={brandPerception.differentiators}
					/>
				</div>

				{/* Risk Alerts */}
				<RiskAlerts risks={aggregatedRisks} />


				{/* Query-Level Table */}
				<QueryLevelTable
					groupedRecords={groupedRecords}
					onSelectRecord={(prompt) => {
						const record = analyzedRecords.find((r) => r.prompt === prompt);
						if (record) setSelectedRecord(record);
					}}
				/>

				{/* Record Detail Dialog */}
				<RecordDetailDialog
					record={selectedRecord}
					open={!!selectedRecord}
					onClose={() => setSelectedRecord(null)}
				/>
			</div>
		</div>
	);
}
