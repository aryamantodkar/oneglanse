import { Card, CardContent, CardHeader, CardTitle } from "@onescope/ui";
import { Shield } from "lucide-react";
import { severityStyles, defaultSeverityStyle } from "../_utils/constants";
import type { RiskData } from "../_utils/types";

export function RiskAlerts({
	risks,
}: {
	risks: RiskData[];
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
