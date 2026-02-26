#!/usr/bin/env python3
"""
Google AI Overview fetcher using curl_cffi.

Usage:
    python3 google_search.py "<query>" "<proxy_url>"

Output (stdout, JSON):
    { "response": str, "sources": [{ "title", "url", "cited_text", "domain" }] }

Exit codes:
    0  — success (even if AI Overview is absent; response will be empty string)
    1  — fatal error (network failure, bad args, etc.)
"""

import sys
import json
import urllib.parse
from html.parser import HTMLParser

try:
    from curl_cffi import requests as cffi_requests
except ImportError:
    sys.stderr.write("curl_cffi not installed. Run: pip3 install curl_cffi\n")
    print(json.dumps({"response": "", "sources": [], "error": "curl_cffi not installed"}))
    sys.exit(1)


# ── HTML Parser ────────────────────────────────────────────────────────────────

# HTML5 void elements — never have a closing tag
_VOID = frozenset({
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
})

# Tags whose content we skip entirely
_SKIP = frozenset({"script", "style", "svg", "noscript", "button"})


class AIOverviewParser(HTMLParser):
    """
    Single-pass event-driven parser that extracts AI Overview text + sources
    from raw Google SERP HTML.

    Google's AI Overview uses these stable structural markers (same in HTTP HTML
    and browser-rendered DOM):
        data-container-id="model-response-placeholder"  → outer wrapper
        data-container-id="main-col"                    → prose response
        data-container-id="rhs-col"                     → source citations
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)

        # --- nesting stack: list of tag names (void elements are never pushed) ---
        self._stack: list[str] = []
        self._skip_depth: int = 0  # >0 means we are inside a _SKIP tag

        # --- AI Overview outer container ---
        self._ao_depth: int = -1        # stack depth when ao container was opened
        self._in_ao: bool = False

        # --- main-col (prose) sub-container ---
        self._mc_depth: int = -1
        self._in_mc: bool = False
        self._response_parts: list[str] = []

        # --- rhs-col (sources) sub-container ---
        self._rhs_depth: int = -1
        self._in_rhs: bool = False

        # --- link tracking (inside rhs-col) ---
        self._link_href: str | None = None
        self._link_title_parts: list[str] = []
        self._link_depth: int = -1
        self._seen_urls: set[str] = set()
        self.sources: list[dict] = []

    # ── helpers ───────────────────────────────────────────────────────────────

    @property
    def _depth(self) -> int:
        return len(self._stack)

    def _attrs(self, attrs) -> dict:
        return dict(attrs)

    # ── SAX callbacks ─────────────────────────────────────────────────────────

    def handle_starttag(self, tag: str, attrs):
        a = self._attrs(attrs)

        # Skip content inside noisy tags
        if self._skip_depth > 0:
            if tag not in _VOID:
                self._skip_depth += 1
            return

        if tag in _SKIP:
            self._skip_depth = 1
            return

        # Push non-void tags onto the nesting stack
        if tag not in _VOID:
            self._stack.append(tag)

        cid = a.get("data-container-id", "")
        xid = a.get("data-xid", "")

        # ── Detect AI Overview outer container ────────────────────────────────
        if not self._in_ao and (
            cid == "model-response-placeholder"
            or xid == "model-response-placeholder"
        ):
            self._in_ao = True
            self._ao_depth = self._depth
            return

        if not self._in_ao:
            return  # Nothing interesting outside the AO block

        # ── Detect main-col (response prose) ─────────────────────────────────
        if not self._in_mc and cid == "main-col":
            self._in_mc = True
            self._mc_depth = self._depth
            return

        # ── Detect rhs-col (sources) ──────────────────────────────────────────
        if not self._in_rhs and cid == "rhs-col":
            self._in_rhs = True
            self._rhs_depth = self._depth
            return

        # ── Track source links inside rhs-col ────────────────────────────────
        if self._in_rhs and tag == "a":
            href = a.get("href", "")
            if href and not _is_google_internal(href):
                self._link_href = href
                self._link_title_parts = []
                self._link_depth = self._depth

    def handle_endtag(self, tag: str):
        if self._skip_depth > 0:
            if tag not in _VOID:
                self._skip_depth -= 1
            return

        # Close active link
        if self._link_href and tag == "a":
            title = " ".join(self._link_title_parts).strip()
            self._record_source(self._link_href, title)
            self._link_href = None
            self._link_title_parts = []
            self._link_depth = -1

        # Pop matching tag from stack
        if self._stack and self._stack[-1] == tag:
            self._stack.pop()

        # Exit sub-containers when we return to the depth they were opened at
        if self._in_mc and self._depth < self._mc_depth:
            self._in_mc = False

        if self._in_rhs and self._depth < self._rhs_depth:
            self._in_rhs = False

        if self._in_ao and self._depth < self._ao_depth:
            self._in_ao = False

    def handle_data(self, data: str):
        if self._skip_depth > 0:
            return
        if not self._in_ao:
            return

        text = data.strip()
        if not text:
            return

        if self._link_href:
            # Collect text for source title
            self._link_title_parts.append(text)
        elif self._in_mc:
            # Collect prose response text
            self._response_parts.append(text)

    # ── Output ────────────────────────────────────────────────────────────────

    def get_response(self) -> str:
        return " ".join(self._response_parts).strip()

    def _record_source(self, url: str, title: str) -> None:
        # Deduplicate on base URL (strip fragment anchors like #:~:text=)
        base_url = url.split("#")[0]
        if not base_url or base_url in self._seen_urls:
            return
        self._seen_urls.add(base_url)

        domain = _extract_domain(url)
        self.sources.append({
            "title": title or domain or url,
            "url": url,
            "cited_text": "",
            "domain": domain,
        })


# ── Helpers ────────────────────────────────────────────────────────────────────

def _is_google_internal(url: str) -> bool:
    try:
        host = urllib.parse.urlparse(url).netloc
        return "google.com" in host or not host
    except Exception:
        return True


def _extract_domain(url: str) -> str | None:
    try:
        host = urllib.parse.urlparse(url).hostname or ""
        return host.removeprefix("www.") or None
    except Exception:
        return None


# ── Core search function ───────────────────────────────────────────────────────

def search(query: str, proxy: str) -> dict:
    params = urllib.parse.urlencode({"q": query, "hl": "en", "gl": "us"})
    url = f"https://www.google.com/search?{params}"

    resp = cffi_requests.get(
        url,
        impersonate="chrome124",
        proxies={"http": proxy, "https": proxy},
        headers={
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return _extract_ai_overview(resp.text)


def _extract_ai_overview(html: str) -> dict:
    parser = AIOverviewParser()
    parser.feed(html)

    response = parser.get_response()
    sources = parser.sources

    return {"response": response, "sources": sources}


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({
            "response": "",
            "sources": [],
            "error": "Usage: google_search.py <query> <proxy_url>",
        }))
        sys.exit(1)

    _query = sys.argv[1]
    _proxy = sys.argv[2]

    try:
        result = search(_query, _proxy)
        print(json.dumps(result))
    except Exception as exc:
        # Graceful fallback — empty result, no crash cascade in Node
        sys.stderr.write(f"google_search.py error: {exc}\n")
        print(json.dumps({"response": "", "sources": [], "error": str(exc)}))
        sys.exit(1)
