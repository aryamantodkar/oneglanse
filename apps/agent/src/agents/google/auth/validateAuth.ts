import { Page } from "playwright";

export async function isGoogleAuthenticated(page: Page): Promise<boolean> {
    // Check if on a Google domain
    if (!page.url().includes("google.com")) return false;
  
    // Wait for the page to be interactive
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  
    // Check for authentication indicators
    let isAuthenticated = false;
  
    for (let i = 0; i < 3; i++) {
      isAuthenticated = await page.evaluate(() => {
        // Check for "Sign in" button (logged out state)
        const signInButton = document.querySelector(
          'a[href*="accounts.google.com/ServiceLogin"]'
        );
        if (signInButton) {
          return false; // User is logged out
        }
  
        // Check for account button with email/user info (MOST RELIABLE INDICATOR)
        // This appears when user is logged in
        const accountButton = document.querySelector(
          'button[aria-label*="Google Account"]'
        );
        if (accountButton) {
          return true;
        }
  
        // Fallback: Check for any element with email pattern
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/;
        const elements = document.querySelectorAll('button, div, span');
        for (let el of elements) {
          if (emailPattern.test(el.textContent || '')) {
            return true;
          }
        }
  
        return false;
      });
  
      if (isAuthenticated !== undefined) break;
  
      // Wait before retrying
      await page.waitForTimeout(2000);
    }
  
    return isAuthenticated;
  }