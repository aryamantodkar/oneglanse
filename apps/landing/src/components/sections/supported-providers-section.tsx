import { Card } from "@oneglanse/ui";
import { getModelFavicon, modelSelectors } from "@oneglanse/utils";
import { Activity, Layers3, ShieldCheck } from "lucide-react";

const PROVIDER_ITEMS = modelSelectors.filter((item) => item.value !== "All Models");

export function SupportedProvidersSection(): React.JSX.Element {
  return (
    <section className="section-shell py-12 sm:py-14" id="supported-providers" aria-labelledby="supported-providers-title">
      <div className="mb-6 sm:mb-8">
        <h2 id="supported-providers-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Supported Providers
        </h2>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-muted-foreground sm:text-base">
          Unified tracking across all LLM providers with consistent metrics and source-level evidence.
        </p>
      </div>

      <Card className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-black">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROVIDER_ITEMS.map((provider) => (
            <article
              key={provider.value}
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-black"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <img
                    src={getModelFavicon(provider.value)}
                    alt={provider.label}
                    className="h-5 w-5 rounded-sm"
                  />
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {provider.label}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  Active
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5 shrink-0" />
                  Live runs
                </span>
                <span className="inline-flex items-center gap-1">
                  <Layers3 className="h-3.5 w-3.5 shrink-0" />
                  Unified scoring
                </span>
              </div>
            </article>
          ))}
        </div>
      </Card>
    </section>
  );
}
