/**
 * testLLMSelectors.mjs
 *
 * Simulates the full selector-generation LLM pipeline without needing Playwright.
 * Feed it a DOM snapshot (captured inline from Chrome MCP) and it calls the real
 * gpt-4.1 API with the exact same prompt/format the agent uses.
 *
 * Usage:
 *   node scripts/testLLMSelectors.mjs <snapshotFile.json> [--stage response|sources|compose]
 *
 * Or pipe JSON directly:
 *   echo '{"provider":"perplexity","stage":"response",...}' | node scripts/testLLMSelectors.mjs
 */

import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY environment variable is required");
  process.exit(1);
}

const SELECTOR_MODEL = "gpt-4.1";

// ─── Same system prompts as model.ts ─────────────────────────────────────────

function buildSystemPrompt(stage) {
  const shared =
    "You receive a DOM snapshot and output CSS selectors. Return only JSON. " +
    "STRICT RULES: " +
    "(1) Copy selector values EXACTLY as they appear in each candidate's selector field — never modify or synthesize one. " +
    "(2) Return [] for any field you cannot identify with certainty — never guess. " +
    "(3) Selector stability order (prefer the highest available): " +
    "name/aria-label/placeholder > data-testid/data-test/data-qa > role/contenteditable > id > classes > positional. " +
    "When multiple selectors are available, ALWAYS prefer the highest-priority type even if a lower-priority one also matches. " +
    "NEVER use id, class, or data-* attribute values that are build-tool generated, per-instance, or turn-specific. Reject short mixed-case hash tokens, generated suffixes, hex/alphanumeric blobs, and ordinal tokens like *-2 or *_9c31ab12. " +
    "Recognisable camelCase library names are stable and allowed (e.g. .ProseMirror, .CodeMirror, .DraftEditor). " +
    "All-lowercase tokens with hyphens or underscores are always stable (e.g. .chat-message, #send-button). " +
    "If the only available selectors are build-tool hash tokens, generated suffix tokens, or per-turn/test-instance selectors, return []. " +
    "(4) Never choose broad page wrappers, historical conversation turns, or elements that span multiple responses. " +
    "(5) Prefer attribute selectors ([data-testid=...], [aria-label=...], [role=...]) over class or id selectors whenever the attribute is semantic and not auto-generated.";

  if (stage === "compose") {
    return (
      `${shared} ` +
      'Your task: identify the SINGLE editable element where a user types their message. ' +
      'Return: { "editor": ["css-selector"] } ' +
      "Pick the primary text input/contenteditable/textarea for message composition. " +
      "Prefer the element the user would click to start typing. Return [] if no editor found."
    );
  }

  if (stage === "response") {
    return (
      `${shared} ` +
      "Your task: identify the container for the latest AI response, and optionally the button that opens the sources panel. " +
      'Return: { "response": ["css-selector"], "sourcesButton": ["css-selector"] } ' +
      '"response": the stable element wrapping the most recent complete answer text. Must contain substantial prose (not just a loading spinner). ' +
      "Prefer the smallest stable container that still contains the whole answer. Reject wrappers for layout, navigation, history, or multiple turns. Reject candidates with editable descendants. " +
      '"sourcesButton": the control (button/tab) that, when clicked, reveals source citations. Return [] if no such button exists.'
    );
  }

  return (
    `${shared} ` +
    "Your task: identify the sources panel container and individual source item selectors. " +
    'Return: { "sourcePanel": ["css-selector"], "sourceItem": ["css-selector"] } ' +
    '"sourcePanel": the visible container holding source/citation cards. May be a sidebar, drawer, or inline section. ' +
    "GROUPING RULE: when multiple sibling lists exist inside a single parent, return the PARENT as sourcePanel — not the individual sibling lists. " +
    "Only return individual list elements as separate sourcePanel entries when they are in genuinely separate UI regions. " +
    "Do not include the full document, page root, or top-level layout wrappers. " +
    '"sourceItem": the selector matching individual source cards or citation links WITHIN the sourcePanel. ' +
    'CRITICAL: sourceItem MUST be scoped to distinguish source cards from surrounding navigation and UI elements. ' +
    'Generic document-wide selectors like "a", "div", "li", "span" that would match hundreds of unrelated elements on the page are INVALID — return [] instead. ' +
    "The selector should be specific enough that querying document.querySelectorAll(sourceItem) inside the sourcePanel returns only source citation cards, not nav links, buttons, or other UI. " +
    "If no sources panel or citations are visible in the screenshot, return [] for both fields."
  );
}

// ─── Schema per stage ────────────────────────────────────────────────────────

function getSchema(stage) {
  if (stage === "compose")
    return { properties: { editor: { type: "array", items: { type: "string" } } }, required: ["editor"] };
  if (stage === "response")
    return {
      properties: {
        response: { type: "array", items: { type: "string" } },
        sourcesButton: { type: "array", items: { type: "string" } },
      },
      required: ["response", "sourcesButton"],
    };
  return {
    properties: {
      sourcePanel: { type: "array", items: { type: "string" } },
      sourceItem: { type: "array", items: { type: "string" } },
    },
    required: ["sourcePanel", "sourceItem"],
  };
}

// ─── OpenAI API call ─────────────────────────────────────────────────────────

function callOpenAI(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request(
      {
        hostname: "api.openai.com",
        port: 443,
        path: "/v1/responses",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${data.slice(0, 500)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function testSelectors(input) {
  const { provider, stage, snapshot, screenshotBase64 } = input;

  const limits = {
    compose: { editables: 10, buttons: 6, content: 4, groups: 4 },
    submit: { editables: 6, buttons: 15, content: 6, groups: 4 },
    response: { editables: 4, buttons: 12, content: 14, groups: 10 },
    sources: { editables: 2, buttons: 6, content: 10, groups: 10 },
  };
  const limit = limits[stage] ?? limits.response;

  const modelPayload = {
    provider,
    stage,
    providerUrl: snapshot.url,
    title: snapshot.title,
    editables: (snapshot.editables || []).slice(0, limit.editables),
    buttons: (snapshot.buttons || []).slice(0, limit.buttons),
    content: (snapshot.content || []).slice(0, limit.content),
    groups: (snapshot.groups || []).slice(0, limit.groups),
    requiredFields: stage === "response" ? ["response"] : stage === "compose" ? ["editor"] : ["sourcePanel", "sourceItem"],
  };

  const useScreenshot = screenshotBase64 && (stage === "response" || stage === "sources");

  const userContent = useScreenshot
    ? [
        { type: "input_text", text: JSON.stringify(modelPayload) },
        { type: "input_image", image_url: `data:image/jpeg;base64,${screenshotBase64}` },
      ]
    : JSON.stringify(modelPayload);

  const { properties, required } = getSchema(stage);

  const payload = {
    model: SELECTOR_MODEL,
    temperature: 0,
    input: [
      { role: "system", content: buildSystemPrompt(stage) },
      { role: "user", content: userContent },
    ],
    text: {
      format: {
        type: "json_schema",
        name: `selector_profile_${stage}`,
        strict: true,
        schema: { type: "object", additionalProperties: false, properties, required },
      },
    },
  };

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Provider: ${provider}  Stage: ${stage}`);
  console.log(`URL: ${snapshot.url}`);
  console.log(`Candidates — editables:${modelPayload.editables.length} buttons:${modelPayload.buttons.length} content:${modelPayload.content.length} groups:${modelPayload.groups.length}`);
  console.log(`Screenshot included: ${useScreenshot ? "YES" : "NO"}`);
  console.log("Calling LLM...");

  const response = await callOpenAI(payload);

  const outputText = response.output_text?.trim() || response.output?.[0]?.content?.[0]?.text?.trim();
  if (!outputText) {
    console.error("ERROR: No output from LLM");
    console.error(JSON.stringify(response, null, 2).slice(0, 500));
    return null;
  }

  const selectors = JSON.parse(outputText);
  console.log("\n✅ LLM Generated Selectors:");
  console.log(JSON.stringify(selectors, null, 2));

  // Validate: check non-empty required fields
  for (const field of required) {
    const val = selectors[field];
    if (!val || val.length === 0) {
      console.warn(`  ⚠️  ${field}: EMPTY — LLM returned []`);
    } else {
      console.log(`  ✓  ${field}: ${val[0]}`);
    }
  }

  return selectors;
}

// ─── Read input ──────────────────────────────────────────────────────────────

async function main() {
  let input;
  const arg = process.argv[2];

  if (arg && fs.existsSync(arg)) {
    input = JSON.parse(fs.readFileSync(arg, "utf8"));
  } else {
    // Read from stdin
    let data = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) data += chunk;
    input = JSON.parse(data);
  }

  // Support array of tests or single test
  const tests = Array.isArray(input) ? input : [input];
  const results = [];

  for (const test of tests) {
    const result = await testSelectors(test).catch((e) => {
      console.error(`FAILED: ${e.message}`);
      return null;
    });
    results.push({ provider: test.provider, stage: test.stage, selectors: result });
  }

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  for (const r of results) {
    const ok = r.selectors && Object.values(r.selectors).some((v) => v.length > 0);
    console.log(`${ok ? "✅" : "❌"} ${r.provider} / ${r.stage}: ${ok ? JSON.stringify(r.selectors) : "FAILED"}`);
  }
}

main().catch(console.error);
