/** model_provider -> items[] */
export type ByModel<T> = Record<string, T[]>;

/** brand_name -> metric */
export type BrandMetricMap = Record<string, BrandMetric>;

export type BrandMetric = {
	mentions: number;
	sentiment: number;
	visibility: number;
	position: number | null;
	website: string;
};
