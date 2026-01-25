import { Page } from "playwright";

export async function isOpenaiAuthenticated(page: Page): Promise<boolean> {
    const url = page.url();
  
    const isChatGPT =
        (url.startsWith("https://chatgpt.com")) &&
        !url.includes("/auth") &&
        !url.includes("/login") &&
        !url.includes("/signup") &&
        !url.includes("/callback");

    return isChatGPT;
}