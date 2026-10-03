import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundle = path.join(root, "node_modules/.cache/llms-full-generator.cjs");
const require = createRequire(import.meta.url);

await mkdir(path.dirname(bundle), { recursive: true });
await build({
	entryPoints: [path.join(root, "src/lib/llms-full.tsx")],
	bundle: true,
	platform: "node",
	format: "cjs",
	jsx: "automatic",
	packages: "external",
	alias: { "@": path.join(root, "src") },
	outfile: bundle,
});

const { fullText } = require(bundle);
await writeFile(path.join(root, "public/llms-full.txt"), fullText());
