import { SectionHeading } from "@/components/common/section-heading";

const STEPS = [
  {
    title: "Deploy",
    description: "Launch the stack with Docker Compose in your own environment.",
  },
  {
    title: "Configure Providers",
    description: "Enable the AI providers and model scopes required by your team.",
  },
  {
    title: "Run Prompts",
    description: "Execute repeatable prompt sets across providers on schedule.",
  },
  {
    title: "Analyze AI Visibility",
    description: "Track rankings, sentiment, competitors, and citation sources.",
  },
] as const;

export function HowItWorksSection(): React.JSX.Element {
  return (
    <section className="section-shell py-14 sm:py-16" id="how-it-works" aria-labelledby="how-it-works-title">
      <SectionHeading
        eyebrow="How It Works"
        title="Operational workflow from deployment to AI visibility analytics"
        description="A simple four-step loop for teams running continuous GEO monitoring and optimization."
      />
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="ui-list-item rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Step {index + 1}</p>
            <h3 className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
