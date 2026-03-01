import { FEATURE_ITEMS } from "@/lib/landing-content";
import { SectionHeading } from "@/components/common/section-heading";

export function FeatureGrid(): React.JSX.Element {
  return (
    <section className="section-shell py-14 sm:py-16" id="features" aria-labelledby="features-title">
      <SectionHeading
        eyebrow="Capabilities"
        title="Purpose-built for AI visibility operations"
        description="From prompt execution to source-level analytics, each layer is designed for repeatability, scale, and auditability."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURE_ITEMS.map((feature) => {
          const Icon = feature.icon;
          return (
            <article key={feature.title} className="surface-card">
              <Icon className="mb-3 h-5 w-5 text-[var(--muted-foreground)]" aria-hidden="true" />
              <h3 className="text-base font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{feature.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
