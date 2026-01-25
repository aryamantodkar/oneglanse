import { Page } from "playwright";

export async function checkPageStability(page:Page) {
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.waitForTimeout(2000);
}