import path from "path";

/** @type {import("next").NextConfig} */
const config = {
  output: "standalone",
  // Required in a monorepo: tells Next.js to trace files from the workspace
  // root so the standalone output mirrors apps/landing/server.js correctly.
  outputFileTracingRoot: path.join(process.cwd(), "../../"),
};

export default config;
