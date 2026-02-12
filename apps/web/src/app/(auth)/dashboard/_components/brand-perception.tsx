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
	  <Card className="flex flex-col rounded-xl border border-gray-100 bg-card p-4 dark:border-gray-800">
		
		{/* Header */}
		<div>
		  <h1 className="text-lg font-semibold leading-none tracking-tight">
			AI Perception
		  </h1>
		  <p className="mt-3 text-xs text-muted-foreground">
			What large models say most about you.
		  </p>
		</div>
  
		<div className="mt-2 space-y-4">
		  
		  {/* Best Known For */}
		  {bestKnownFor && (
			<div className="rounded-lg border border-gray-100 px-3 py-3">
			  <p className="text-xs text-muted-foreground">
				Best Known For
			  </p>
			  <p className="mt-1 text-sm font-medium leading-relaxed">
				{bestKnownFor.charAt(0).toUpperCase() + bestKnownFor.slice(1)}
			  </p>
			</div>
		  )}
  
		  {/* Core Claims */}
		  {coreClaims.length > 0 && (
			<div>
			  <p className="mb-2 text-xs text-muted-foreground">
				Key Claims
			  </p>
			  <ul className="space-y-2">
				{coreClaims.slice(0, 4).map((claim) => (
				  <li
					key={claim}
					className="flex items-start gap-2 rounded-lg border border-gray-100 px-3 py-2 text-xs leading-relaxed dark:border-gray-800"
				  >
					<span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-gray-500" />
					<span>
					  {claim.charAt(0).toUpperCase() + claim.slice(1)}
					</span>
				  </li>
				))}
			  </ul>
			</div>
		  )}
  
		  {/* Differentiators */}
		  {differentiators.length > 0 && (
			<div>
			  <p className="mb-2 text-xs text-muted-foreground">
				Differentiators
			  </p>
			  <div className="flex flex-wrap gap-2">
				{differentiators.slice(0, 5).map((diff) => (
				  <span
					key={diff}
					className="rounded-full border border-gray-200 px-3 py-1 text-[11px] font-medium text-muted-foreground dark:border-gray-700"
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
