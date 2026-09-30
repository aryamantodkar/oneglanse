<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), use it before broad searches or file-by-file reading when you need to understand code structure:

- **MCP tool** (when available): `codegraph_explore` returns relevant source, call paths, dependents, and related tests. Name a file or symbol in the query to read its current line-numbered source.
- **CLI fallback:** `pnpm exec codegraph explore "<symbol names or question>"`.

If there is no `.codegraph/` directory, run `pnpm codegraph:init` before using CodeGraph.
<!-- CODEGRAPH_END -->
