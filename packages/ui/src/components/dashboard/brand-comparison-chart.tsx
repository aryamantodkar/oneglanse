"use client";
import { LineChart } from "lucide-react";
import { useRef, useState } from "react";
import { Card } from "../card.js";
import type { DashboardCompetitorData } from "./types.js";

type MetricKey = "presence" | "recommendation" | "sentiment" | "rankStrength";

type SeriesPoint = {
	name: string;
	domain: string;
	isBrand: boolean;
	composite: number;
	values: Record<MetricKey, number>;
};

const METRIC_CONFIG: { key: MetricKey; label: string }[] = [
	{ key: "presence", label: "Presence" },
	{ key: "recommendation", label: "Recommendation" },
	{ key: "sentiment", label: "Sentiment" },
	{ key: "rankStrength", label: "Rank Strength" },
];

const SERIES_COLORS = ["#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F"];

function getSeriesColor(index: number): string {
	return (
		SERIES_COLORS[index % SERIES_COLORS.length] ?? SERIES_COLORS[0] ?? "#4E79A7"
	);
}

function clampScore(value: number): number {
	if (Number.isNaN(value)) return 0;
	return Math.max(0, Math.min(100, Math.round(value)));
}

function rankToStrength(rank: number | null): number {
	if (rank === null) return 0;
	if (rank >= 6) return 30;
	if (rank <= 1) return 100;

	const points: Array<{ x: number; y: number }> = [
		{ x: 1, y: 100 },
		{ x: 2, y: 80 },
		{ x: 3, y: 65 },
		{ x: 4, y: 50 },
		{ x: 5, y: 40 },
		{ x: 6, y: 30 },
	];

	for (let i = 0; i < points.length - 1; i++) {
		const start = points[i];
		const end = points[i + 1];
		if (!start || !end) continue;
		if (rank >= start.x && rank <= end.x) {
			const t = (rank - start.x) / (end.x - start.x);
			return clampScore(start.y + t * (end.y - start.y));
		}
	}

	return 30;
}

function buildPath(points: Array<{ x: number; y: number }>): string {
	return points
		.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`)
		.join(" ");
}

export function BrandComparisonChart({
	competitors,
	brandName,
	brandDomain,
	totalResponses,
	brandPresenceRate,
	brandRecommendationRate,
	brandSentimentScore,
	brandAvgRank,
}: {
	competitors: DashboardCompetitorData[];
	brandName: string;
	brandDomain: string;
	totalResponses: number;
	brandPresenceRate: number;
	brandRecommendationRate: number;
	brandSentimentScore: number;
	brandAvgRank: number | null;
}) {
	const svgRef = useRef<SVGSVGElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const [hoveredPoint, setHoveredPoint] = useState<{
		name: string;
		metric: string;
		value: number;
		leftPx: number;
		topPx: number;
		color: string;
	} | null>(null);
	const [hoveredBrand, setHoveredBrand] = useState<string | null>(null);

	const rivals = competitors
		.filter((c) => !c.isBrand)
		.sort((a, b) => {
			if (a.appearances !== b.appearances) return b.appearances - a.appearances;
			if (a.avgRank !== null && b.avgRank !== null && a.avgRank !== b.avgRank) {
				return a.avgRank - b.avgRank;
			}
			return b.recCount - a.recCount;
		})
		.slice(0, 4);

	const series: SeriesPoint[] = [
		{
			name: brandName,
			domain: brandDomain,
			isBrand: true,
			values: {
				presence: clampScore(brandPresenceRate),
				recommendation: clampScore(brandRecommendationRate),
				sentiment: clampScore(brandSentimentScore),
				rankStrength: rankToStrength(brandAvgRank),
			},
			composite: 0,
		},
		...rivals.map((r) => ({
			name: r.name,
			domain: r.domain,
			isBrand: false,
			values: {
				presence: clampScore(
					totalResponses > 0 ? (r.appearances / totalResponses) * 100 : 0,
				),
				recommendation: clampScore(
					r.appearances > 0 ? (r.recCount / r.appearances) * 100 : 0,
				),
				sentiment: clampScore(r.avgSentiment),
				rankStrength: rankToStrength(r.avgRank),
			},
			composite: 0,
		})),
	]
		.map((entry) => ({
			...entry,
			composite: clampScore(
				(entry.values.presence +
					entry.values.recommendation +
					entry.values.sentiment +
					entry.values.rankStrength) /
					4,
			),
		}))
		.sort((a, b) => {
			if (a.composite !== b.composite) return b.composite - a.composite;
			if (a.isBrand && !b.isBrand) return -1;
			if (!a.isBrand && b.isBrand) return 1;
			return a.name.localeCompare(b.name);
		});

	if (series.length <= 1 || totalResponses === 0) {
		return (
			<Card className="flex min-h-[280px] flex-col p-5">
				<div>
					<h1 className="mt-2 text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100">
						Brand Comparison
					</h1>
					<p className="mt-2 text-xs text-muted-foreground">
						Multi-metric benchmark across your closest answer rivals.
					</p>
				</div>
				<div className="flex flex-1 items-center justify-center">
					<div className="w-full max-w-md rounded-[24px] border border-gray-100/80 bg-white p-6 text-center shadow-[0_20px_60px_-32px_rgba(15,23,42,0.18)] dark:border-gray-800 dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.55)]">
						<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-gray-200/70 bg-stone-100 dark:border-gray-800 dark:bg-neutral-900">
							<LineChart className="h-5 w-5 text-muted-foreground" />
						</div>
						<h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
							Not enough comparison data
						</h3>
						<p className="mt-2 text-xs leading-relaxed text-muted-foreground">
							Run more analyzed prompts to unlock cross-brand trend comparison.
						</p>
					</div>
				</div>
			</Card>
		);
	}

	const width = 760;
	const height = 280;
	const left = 50;
	const right = 16;
	const top = 20;
	const bottom = 44;
	const plotWidth = width - left - right;
	const plotHeight = height - top - bottom;

	const xFor = (index: number) =>
		left + (index * plotWidth) / Math.max(1, METRIC_CONFIG.length - 1);
	const yFor = (score: number) => top + ((100 - score) / 100) * plotHeight;
	const getTooltipPosition = (x: number, y: number) => {
		if (!svgRef.current || !containerRef.current) {
			return { leftPx: x, topPx: y };
		}

		const containerRect = containerRef.current.getBoundingClientRect();
		const ctm = svgRef.current.getScreenCTM();

		if (!ctm) {
			return { leftPx: x, topPx: y };
		}

		const point = svgRef.current.createSVGPoint();
		point.x = x;
		point.y = y;
		const screenPoint = point.matrixTransform(ctm);

		const rawLeft = screenPoint.x - containerRect.left;
		const rawTop = screenPoint.y - containerRect.top;
		return {
			leftPx: Math.max(72, Math.min(containerRect.width - 72, rawLeft)),
			topPx: Math.max(24, rawTop),
		};
	};

	const leader = [...series].sort((a, b) => b.composite - a.composite)[0];

	return (
		<Card className="p-5">
			<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0">
					<h1 className="mt-1 text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100">
						Brand Comparison
					</h1>
					<p className="mt-2 text-xs text-muted-foreground">
						Presence, recommendation strength, sentiment, and ranking strength
						in one view.
					</p>
				</div>
				<span className="max-w-full self-start rounded-full border border-transparent bg-stone-50 px-3 py-1 text-[11px] font-semibold text-gray-600 shadow-[0_14px_36px_-28px_rgba(15,23,42,0.18)] dark:bg-neutral-900/80 dark:text-gray-300 dark:shadow-[0_14px_36px_-28px_rgba(0,0,0,0.44)]">
					Leader: {leader?.name ?? "N/A"}
				</span>
			</div>

			<div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_260px]">
				<div
					ref={containerRef}
					className="relative"
					onMouseLeave={() => setHoveredPoint(null)}
				>
					<div className="overflow-x-auto">
						<svg
							ref={svgRef}
							viewBox={`0 0 ${width} ${height}`}
							className="h-[280px] w-full min-w-[480px] sm:min-w-[620px] lg:min-w-[680px]"
							role="img"
							aria-label="Brand comparison chart"
						>
							{[0, 25, 50, 75, 100].map((tick) => {
								const y = yFor(tick);
								return (
									<g key={`grid-${tick}`}>
										<line
											x1={left}
											y1={y}
											x2={width - right}
											y2={y}
											stroke="currentColor"
											className="text-gray-200 dark:text-gray-800"
											strokeDasharray={tick === 0 ? "0" : "3 5"}
										/>
										<text
											x={left - 10}
											y={y + 4}
											textAnchor="end"
											className="fill-gray-400 text-[10px]"
										>
											{tick}
										</text>
									</g>
								);
							})}

							{series.map((s, idx) => {
								const color = getSeriesColor(idx);
								const points = METRIC_CONFIG.map((metric, metricIndex) => ({
									x: xFor(metricIndex),
									y: yFor(s.values[metric.key]),
								}));
								const d = buildPath(points);
								const isHovered = hoveredBrand === s.name;
								const isFaded = hoveredBrand && hoveredBrand !== s.name;
								return (
									<g key={s.name}>
										<path
											d={d}
											fill="none"
											stroke={color}
											strokeWidth={isHovered ? 4 : s.isBrand ? 3 : 2}
											strokeLinecap="round"
											strokeLinejoin="round"
											opacity={isFaded ? 0.2 : s.isBrand ? 1 : 0.85}
										/>
										{points.map((p, pointIdx) => (
											<circle
												key={`${s.name}-${METRIC_CONFIG[pointIdx]?.key}`}
												cx={p.x}
												cy={p.y}
												r={isHovered ? 6 : s.isBrand ? 4.5 : 3.5}
												fill={color}
												stroke="white"
												strokeWidth={isHovered ? 2 : 1.5}
												className="cursor-pointer"
												opacity={isFaded ? 0.2 : 1}
												onMouseEnter={() => {
													const metric = METRIC_CONFIG[pointIdx];
													if (!metric) return;
													const { leftPx, topPx } = getTooltipPosition(
														p.x,
														p.y,
													);
													setHoveredPoint({
														name: s.name,
														metric: metric.label,
														value: s.values[metric.key],
														leftPx,
														topPx,
														color,
													});
												}}
											/>
										))}
									</g>
								);
							})}

							{METRIC_CONFIG.map((metric, idx) => (
								<text
									key={metric.key}
									x={xFor(idx)}
									y={height - 14}
									textAnchor="middle"
									className="fill-gray-500 text-[11px] font-medium"
								>
									{metric.label}
								</text>
							))}
						</svg>
					</div>

					{hoveredPoint && !hoveredBrand && (
						<div
							className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-[110%] rounded-2xl border border-transparent bg-white px-2.5 py-2 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.28)] dark:border-transparent dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.7)]"
							style={{
								left: `${hoveredPoint.leftPx}px`,
								top: `${hoveredPoint.topPx}px`,
							}}
						>
							<div className="flex items-center gap-1.5">
								<span
									className="h-2 w-2 rounded-full"
									style={{ backgroundColor: hoveredPoint.color }}
								/>
								<p className="max-w-[170px] truncate text-[11px] font-semibold text-gray-900 dark:text-gray-100">
									{hoveredPoint.name}
								</p>
							</div>
							<p className="mt-1 text-[10px] text-muted-foreground">
								{hoveredPoint.metric}:{" "}
								<span className="font-semibold text-gray-900 dark:text-gray-100">
									{hoveredPoint.value}
								</span>
							</p>
						</div>
					)}

					{hoveredBrand &&
						(() => {
							const brandData = series.find((s) => s.name === hoveredBrand);
							const brandIndex = series.findIndex(
								(s) => s.name === hoveredBrand,
							);
							const color = getSeriesColor(brandIndex);

							if (!brandData) return null;

							return METRIC_CONFIG.map((metric, metricIdx) => {
								const value = brandData.values[metric.key];
								const x = xFor(metricIdx);
								const y = yFor(value);
								const { leftPx, topPx } = getTooltipPosition(x, y);

								return (
									<div
										key={`${hoveredBrand}-${metric.key}`}
										className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-[110%] rounded-2xl border border-transparent bg-white px-2.5 py-2 shadow-[0_20px_60px_-32px_rgba(15,23,42,0.28)] dark:border-transparent dark:bg-neutral-950 dark:shadow-[0_20px_60px_-32px_rgba(0,0,0,0.7)]"
										style={{
											left: `${leftPx}px`,
											top: `${topPx}px`,
										}}
									>
										<div className="flex items-center gap-1.5">
											<span
												className="h-2 w-2 rounded-full"
												style={{ backgroundColor: color }}
											/>
											<p className="max-w-[170px] truncate text-[11px] font-semibold text-gray-900 dark:text-gray-100">
												{brandData.name}
											</p>
										</div>
										<p className="mt-1 text-[10px] text-muted-foreground">
											{metric.label}:{" "}
											<span className="font-semibold text-gray-900 dark:text-gray-100">
												{value}
											</span>
										</p>
									</div>
								);
							});
						})()}
				</div>

				<div className="min-w-0 space-y-2">
					{series.map((s, idx) => {
						const color = getSeriesColor(idx);
						return (
							<div
								key={`legend-${s.name}`}
								className={`ui-list-item cursor-pointer rounded-[22px] border px-3 py-2 transition-all ${
									s.isBrand
										? "border-transparent bg-stone-50 dark:border-transparent dark:bg-neutral-900/80"
										: "border-gray-100/80 bg-white dark:border-gray-800 dark:bg-neutral-950"
								} ${hoveredBrand === s.name ? "ring-2 ring-gray-300 dark:ring-gray-600" : ""}`}
								onMouseEnter={() => setHoveredBrand(s.name)}
								onMouseLeave={() => setHoveredBrand(null)}
							>
								<div className="flex min-w-0 items-center justify-between gap-2">
									<div className="flex min-w-0 items-center gap-2">
										<span
											className="h-2.5 w-2.5 shrink-0 rounded-full"
											style={{ backgroundColor: color }}
										/>
										<p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
											{s.name}
										</p>
									</div>
									<span className="text-xs font-semibold text-muted-foreground">
										{s.composite}/100
									</span>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</Card>
	);
}
