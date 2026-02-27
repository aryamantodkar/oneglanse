import type { Provider, HealthCheckResult } from "@oneglanse/types";
import type { Page } from "playwright";
import { getBotDetectionMessage, PROVIDER_EDITOR_SELECTORS } from "@oneglanse/utils";
import { logger } from "../utils/logger.js";

export async function pageHealthCheck(
	page: Page,
	provider: Provider,
): Promise<HealthCheckResult> {
	const start = Date.now();

	try {
		// 1. Bot detection / Cloudflare challenge (~1s)
		const botDetection = await page
			.evaluate(() => {
				const body = document.body?.innerText?.toLowerCase() ?? "";
				const title = document.title?.toLowerCase() ?? "";

				if (
					title.includes("just a moment") ||
					body.includes("checking your browser")
				)
					return "cloudflare";
				if (
					document.querySelector('iframe[src*="captcha"]') ||
					document.querySelector('[class*="captcha" i]') ||
					document.querySelector("#challenge-form")
				)
					return "captcha";
				if (document.querySelector('iframe[src*="turnstile"]'))
					return "turnstile";

				return null;
			})
			.catch(() => null);

		if (botDetection) {
			logger.warn(
				`[${provider}] Health check: bot detection (${botDetection}) in ${Date.now() - start}ms`,
			);
			return {
				healthy: false,
				reason: `bot_detection:${botDetection}`,
				failureType: "bot_detection",
				userMessage: getBotDetectionMessage(botDetection),
			};
		}

		// 2. Login/signup form visible (~0.5s)
		const loginVisible = await page
			.evaluate(() => {
				const body = document.body?.innerText ?? "";
				const hasPasswordField = !!document.querySelector(
					'input[type="password"]',
				);
				const hasLoginForm = !!document.querySelector(
					'form[action*="login"], form[action*="auth"], form[action*="signin"]',
				);
				const bodyStart = body.slice(0, 2000).toLowerCase();
				const hasLoginText =
					/sign in to|log in to|create.*account|sign up for/i.test(bodyStart);

				return hasPasswordField || hasLoginForm || hasLoginText;
			})
			.catch(() => false);

		if (loginVisible) {
			logger.warn(
				`[${provider}] Health check: login page detected in ${Date.now() - start}ms`,
			);
			return {
				healthy: false,
				reason: "logged_out",
				failureType: "logged_out",
				userMessage: "You were logged out. Please log in again.",
			};
		}

		// 3. Rate limit detection (~0.5s)
		const rateLimited = await page
			.evaluate(() => {
				const text = document.body?.innerText?.toLowerCase() ?? "";
				const snippet = text.slice(0, 3000);
				return /rate limit|too many requests|try again later|usage limit|you've reached/i.test(
					snippet,
				);
			})
			.catch(() => false);

		if (rateLimited) {
			logger.warn(
				`[${provider}] Health check: rate limited in ${Date.now() - start}ms`,
			);
			return {
				healthy: false,
				reason: "rate_limited",
				failureType: "rate_limited",
				userMessage: "Rate limited. Please wait a few minutes and try again.",
			};
		}

		// 4. Provider-specific editor presence with quick timeout
		const selectors = PROVIDER_EDITOR_SELECTORS[provider] || [];
		let editorFound = false;
		let foundSelector = "";

		for (const selector of selectors) {
			try {
				await page
					.locator(selector)
					.first()
					.waitFor({ state: "visible", timeout: 2000 }); // 2s timeout per selector
				editorFound = true;
				foundSelector = selector;
				break;
			} catch {
				// Try next selector
			}
		}

		if (!editorFound) {
			logger.warn(
				`[${provider}] Health check: no editor found in ${Date.now() - start}ms`,
			);
			return {
				healthy: false,
				reason: "no_editor",
				failureType: "no_editor",
				userMessage:
					"Page didn't load correctly. Please refresh and try again.",
			};
		}

		// 5. Verify the editor is actually interactive (not disabled/readonly)
		const isEditable = await page
			.evaluate((sel) => {
				const editor = document.querySelector(sel);
				if (!editor) return false;

				// Check contenteditable
				const contentEditable = editor.getAttribute("contenteditable");
				if (contentEditable === "false") return false;

				// Check disabled/readonly
				if (
					editor instanceof HTMLInputElement ||
					editor instanceof HTMLTextAreaElement
				) {
					if (editor.disabled || editor.readOnly) return false;
				}

				// Check if element is visible and not hidden
				const rect = editor.getBoundingClientRect();
				if (rect.width === 0 || rect.height === 0) return false;

				return true;
			}, foundSelector)
			.catch(() => false);

		if (!isEditable) {
			logger.warn(
				`[${provider}] Health check: editor found but not interactive in ${Date.now() - start}ms`,
			);
			return {
				healthy: false,
				reason: "editor_not_interactive",
				failureType: "no_editor",
				userMessage: "Editor is not interactive. Please refresh and try again.",
			};
		}

		logger.debug(
			`[${provider}] Health check passed in ${Date.now() - start}ms`,
		);
		return { healthy: true };
	} catch (err: any) {
		logger.warn(`[${provider}] Health check error: ${err?.message}`);
		return { healthy: false, reason: err?.message, failureType: "unknown" };
	}
}
