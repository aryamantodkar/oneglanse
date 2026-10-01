# @oneglanse/services

Services owns reusable application behavior between Web and Agent and the data stores. Web routes use it for workspace operations, prompt and response persistence, queue submission, analysis orchestration, and scheduling. Agent uses it to persist captured responses and trigger analysis.

Keep HTTP and UI behavior in Web. Keep provider browser behavior in Agent. See [ARCHITECTURE.md](../../ARCHITECTURE.md) for the system boundary.

User-facing configuration is documented in [environment variables](../../docs/environment-variables.mdx).
