export type FailureType =
	| "connection_error"
	| "bot_detection"
	| "logged_out"
	| "rate_limited"
	| "no_editor"
	| "extraction_failed"
	| "timeout"
	| "unknown";


export type HealthCheckResult = {
	healthy: boolean;
	reason?: string;
	failureType?: FailureType;
	userMessage?: string; // User-friendly error message
};