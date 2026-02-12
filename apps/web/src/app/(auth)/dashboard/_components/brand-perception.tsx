import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import { pricingLabels } from "../_utils/constants";

export function BrandPerceptionCard({
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
	  <Card className="flex flex-col rounded-xl border border-gray-100 bg-card p-5 dark:border-gray-800">
  
		{/* Header */}
		<div>
		  <h1 className="text-lg font-semibold tracking-tight">
			AI Perception
		  </h1>
		  <p className="mt-1 text-xs text-muted-foreground">
			What large models say most about you.
		  </p>
		</div>
  
		<div className="mt-5 space-y-6">
  
		  {/* Best Known For */}
		  {bestKnownFor && (
			<div className="rounded-xl border border-gray-200 bg-muted/40 px-4 py-4 dark:border-gray-800">
			  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
				Best Known For
			  </p>
			  <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground">
				{bestKnownFor.charAt(0).toUpperCase() + bestKnownFor.slice(1)}
			  </p>
			</div>
		  )}
  
		  {/* Pricing */}
		  <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2 text-xs dark:border-gray-800">
			<span className="text-muted-foreground">
			  Pricing
			</span>
			<span className="font-semibold text-foreground">
			  {pricingLabels[pricingPerception] ?? pricingPerception}
			</span>
		  </div>
  
		  {/* Key Claims — More Prominent */}
		  {coreClaims.length > 0 && (
			<div>
			  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Key Claims
			  </p>
  
			  <div className="space-y-3">
				{coreClaims.slice(0, 4).map((claim) => (
				  <div
					key={claim}
					className="group relative rounded-xl border border-gray-200 bg-muted/30 px-4 py-3 transition-all hover:shadow-sm dark:border-gray-800"
				  >
					{/* Subtle Accent */}
					<div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-foreground/10 group-hover:bg-foreground/20 transition-all" />
  
					<p className="pl-2 text-sm font-medium leading-relaxed text-foreground">
					  {claim.charAt(0).toUpperCase() + claim.slice(1)}
					</p>
				  </div>
				))}
			  </div>
			</div>
		  )}
  
		  {/* Differentiators — Strong Signal Pills */}
		  {differentiators.length > 0 && (
			<div>
			  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Differentiators
			  </p>
  
			  <div className="flex flex-wrap gap-2">
				{differentiators.slice(0, 5).map((diff) => (
				  <span
					key={diff}
					className="
					  inline-flex items-center
					  rounded-md
					  bg-muted/50
					  px-3 py-1.5
					  text-xs font-semibold
					  text-foreground
					  transition-all
					  hover:bg-muted
					  hover:shadow-sm
					"
				  >
					{diff.charAt(0).toUpperCase() + diff.slice(1)}
				  </span>
				))}
			  </div>
			</div>
		  )}
		</div>
	  </Card>
	);
  }