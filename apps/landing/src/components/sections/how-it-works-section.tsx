import { SectionHeading } from "@/components/common/section-heading";

const STEPS = [
  {
    title: "Deploy",
    description: "Run the stack with Docker Compose.",
  },
  {
    title: "Connect Providers",
    description: "Set API credentials and workspace controls.",
  },
  {
    title: "Run Prompt Sets",
    description: "Execute recurring prompts across providers.",
  },
  {
    title: "Review Insights",
    description: "Inspect visibility, sentiment, and source evidence.",
  },
] as const;

export function HowItWorksSection(): React.JSX.Element {
  return (
    <section
      className="section-shell py-12 sm:py-14"
      id="how-it-works"
      aria-labelledby="how-it-works-title"
    >
      <SectionHeading
        eyebrow="How It Works"
        title="From deploy to decision in four steps."
      />
      <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="ui-list-item rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-black"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Step {index + 1}
            </p>
            <h3 className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {step.description}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
