import { Provider } from "../types/types.js";

export class AgentAuthError extends Error {
    constructor(public provider: Provider) {
      super(`${provider.charAt(0).toUpperCase()}${provider.slice(1)} not authenticated. Please sign in again.`);
      this.name = "AgentAuthError";
    }
  }