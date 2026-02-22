export class NoAIOverviewError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "NoAIOverviewError";
		Object.setPrototypeOf(this, NoAIOverviewError.prototype);
	}
}
