const DEBUG_ENABLED =
  process.env.DEBUG === "true" ||
  process.env.NODE_ENV !== "production";

function formatArgs(args: any[]) {
  return args.map(arg =>
    arg instanceof Error
      ? arg.stack || arg.message
      : arg
  );
}

export const logger = {
  error: (...args: any[]) => {
    console.error(
      "❌",
      new Date().toISOString(),
      ...formatArgs(args)
    );
  },

  warn: (...args: any[]) => {
    console.warn(
      "⚠️",
      new Date().toISOString(),
      ...formatArgs(args)
    );
  },

  success: (...args: any[]) => {
    console.log(
      "✅",
      new Date().toISOString(),
      ...formatArgs(args)
    );
  },

  log: (...args: any[]) => {
    console.log(
      new Date().toISOString(),
      ...formatArgs(args)
    );
  },

  debug: (...args: any[]) => {
    if (!DEBUG_ENABLED) return;
    console.log(
      "🐛",
      new Date().toISOString(),
      ...formatArgs(args)
    );
  },
};