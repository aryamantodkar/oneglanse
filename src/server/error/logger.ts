export const Logger = {
    info: (...args: unknown[]) => console.info("[INFO]", ...args),
    warn: (...args: unknown[]) => console.warn("[WARN]", ...args),
    error: (...args: unknown[]) => console.error("[ERROR]", ...args),
};

export function captureException(err: unknown, context?: Record<string, unknown>) {
    // Hook to send to Sentry or another error tracker
    Logger.error("Captured exception:", err, context);
}