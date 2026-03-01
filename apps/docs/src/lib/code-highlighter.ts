import type { CodeToken } from "@/lib/markdown-types";

const KEYWORD_PATTERN = /\b(const|let|var|function|return|import|export|from|if|else|for|while|try|catch|async|await)\b/g;
const NUMBER_PATTERN = /\b\d+(?:\.\d+)?\b/g;
const STRING_PATTERN = /("[^"]*"|'[^']*')/g;
const COMMENT_PATTERN = /(#[^\n]*|\/\/[^\n]*)/g;

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function highlightCode(code: string): CodeToken[] {
  const escaped = escapeHtml(code);
  const tokens: CodeToken[] = [];
  let cursor = 0;

  const matches: Array<{ start: number; end: number; className: string }> = [];
  const patterns = [
    { pattern: COMMENT_PATTERN, className: "text-emerald-600 dark:text-emerald-300" },
    { pattern: STRING_PATTERN, className: "text-amber-600 dark:text-amber-300" },
    { pattern: KEYWORD_PATTERN, className: "text-sky-700 dark:text-sky-300" },
    { pattern: NUMBER_PATTERN, className: "text-violet-700 dark:text-violet-300" },
  ];

  for (const { pattern, className } of patterns) {
    for (const match of escaped.matchAll(new RegExp(pattern.source, "g"))) {
      const value = match[0];
      const index = match.index;
      if (index === undefined) continue;
      matches.push({ start: index, end: index + value.length, className });
    }
  }

  matches.sort((a, b) => a.start - b.start);

  for (const match of matches) {
    if (match.start < cursor) continue;
    if (match.start > cursor) {
      tokens.push({ value: escaped.slice(cursor, match.start), className: "text-[var(--foreground)]" });
    }
    tokens.push({ value: escaped.slice(match.start, match.end), className: match.className });
    cursor = match.end;
  }

  if (cursor < escaped.length) {
    tokens.push({ value: escaped.slice(cursor), className: "text-[var(--foreground)]" });
  }

  return tokens;
}
