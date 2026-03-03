import path from "node:path";
import nextra from "nextra";

const withNextra = nextra({
  search: {
    codeblocks: true,
  },
  defaultShowCopyCode: true,
});

/** @type {import('next').NextConfig} */
const config = {
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../../"),
  basePath: "/docs",
  trailingSlash: true,
};

export default withNextra(config);
