import path from "path";
import fs from "fs";
import { Page } from "playwright";
import { logger } from "./logger.js";

export async function dumpPanelHTML(page: Page, filename: string = 'sources-panel.html'): Promise<void> {
    logger.debug("  📄 Dumping panel HTML...");
  
    // Wait a bit for panel to be open
    await page.waitForTimeout(1000);
  
    // Get the entire page HTML
    const fullHTML = await page.content();
    
    // Save to file
    const outputPath = path.join(process.cwd(), filename);
    fs.writeFileSync(outputPath, fullHTML, 'utf-8');
    
    logger.debug(`    ✓ HTML saved to: ${outputPath}`);
}