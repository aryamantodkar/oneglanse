import { Page } from "playwright";

export async function isAnthropicAuthenticated(page: Page): Promise<boolean> {
    const url = page.url();
  
    // Must be on claude.ai and NOT on login
    const isClaude =
        url.startsWith("https://claude.ai") && url.includes("/new") &&
        !url.includes("/login") &&
        !url.includes("/signup") &&
        !url.includes("/auth");

    return isClaude;
}