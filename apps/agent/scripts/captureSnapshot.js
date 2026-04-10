/**
 * captureSnapshot.js
 *
 * This file contains the DOM capture function to paste into Chrome DevTools /
 * run via Chrome MCP JS tool. Returns the same snapshot shape as captureSelectorSnapshot()
 * in snapshot.ts (editables / buttons / content / groups).
 *
 * Usage: paste captureSnapshotForStage("response") into browser console
 */

// This is the function to run inline in the browser:
function captureSnapshotForStage(stage) {
  function esc(v) {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(v);
    return v.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, "\\$1");
  }

  function isStableToken(t) {
    if (!t || t.length < 3) return false;
    if (/[A-Z]/.test(t) && !/^[A-Z][a-z]+([A-Z][a-z]+)*$/.test(t)) return false;
    if (/^[0-9a-f]{6,}$/i.test(t)) return false;
    if (/[_-]/.test(t)) {
      return t.split(/[_-]/).every(s => /^[a-z][a-z0-9]*$/.test(s) && s.length >= 2);
    }
    return /^[a-z][a-z0-9]+$/.test(t) && t.length >= 4;
  }

  function stableClasses(el) {
    return Array.from(el.classList).filter(isStableToken).slice(0, 4);
  }

  function qCount(sel) {
    try { return document.querySelectorAll(sel).length; } catch { return 99; }
  }

  function buildSel(el) {
    const tag = el.tagName.toLowerCase();
    // 1. Semantic attrs
    for (const attr of ["name","aria-label","placeholder","data-testid","data-test-id","data-test","data-qa","data-cy","data-state","rel"]) {
      const v = el.getAttribute(attr)?.trim();
      if (!v) continue;
      // For data-* attrs, check token stability; for others accept freely
      if (attr.startsWith("data-") && attr !== "data-state") {
        if (!isStableToken(v)) continue;
      }
      const sel = `${tag}[${attr}="${v.replace(/"/g,'\\"')}"]`;
      if (qCount(sel) === 1) return sel;
    }
    // 1b. aria-controls suffix-match
    const ac = el.getAttribute("aria-controls")?.trim();
    if (ac) {
      if (qCount(`${tag}[aria-controls="${ac}"]`) === 1) return `${tag}[aria-controls="${ac}"]`;
      const parts = ac.split("-");
      for (let tail = 1; tail <= Math.min(parts.length - 1, 4); tail++) {
        const suf = "-" + parts.slice(parts.length - tail).join("-");
        if (/^-[a-z][a-z-]{2,}$/.test(suf)) {
          const s = `${tag}[aria-controls$="${suf}"]`;
          if (qCount(s) <= 2) return s;
        }
      }
    }
    // 2. role
    const role = el.getAttribute("role")?.trim();
    if (role && qCount(`${tag}[role="${role}"]`) === 1) return `${tag}[role="${role}"]`;
    // 3. contenteditable
    if (el instanceof HTMLElement && el.isContentEditable) {
      if (qCount(`${tag}[contenteditable="true"]`) === 1) return `${tag}[contenteditable="true"]`;
    }
    // 4. stable ID
    const id = el.getAttribute("id")?.trim();
    if (id && isStableToken(id)) {
      const sel = `#${esc(id)}`;
      if (qCount(sel) === 1) return sel;
    }
    // 5. stable classes
    const cls = stableClasses(el);
    for (let c = Math.min(2, cls.length); c >= 1; c--) {
      const sel = `${tag}${cls.slice(0, c).map(t => `.${esc(t)}`).join("")}`;
      if (qCount(sel) === 1) return sel;
    }
    // 6. positional fallback
    const segs = [];
    let cur = el;
    for (let d = 0; cur && d < 5; d++) {
      const t2 = cur.tagName.toLowerCase();
      const cid = cur.getAttribute("id")?.trim();
      if (cid && isStableToken(cid)) { segs.unshift(`#${esc(cid)}`); break; }
      const siblings = cur.parentElement ? Array.from(cur.parentElement.children).filter(s => s.tagName === cur.tagName) : [];
      const idx = siblings.length > 1 ? siblings.indexOf(cur) + 1 : 0;
      let seg = t2;
      const tok = stableClasses(cur)[0];
      if (tok) seg += `.${esc(tok)}`;
      if (idx > 0) seg += `:nth-of-type(${idx})`;
      segs.unshift(seg);
      if (qCount(segs.join(" > ")) === 1) break;
      cur = cur.parentElement;
    }
    return segs.join(" > ") || tag;
  }

  function isVis(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (!el.isConnected) return false;
    const s = window.getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0" || el.hidden) return false;
    const r = el.getBoundingClientRect();
    return r.width >= 8 && r.height >= 8;
  }

  function textOf(el) {
    return ((el instanceof HTMLElement ? el.innerText : null) || el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function toC(el, extra = {}) {
    const text = textOf(el).slice(0, 320);
    const r = el.getBoundingClientRect();
    let depth = 0; let p = el.parentElement;
    while (p) { depth++; p = p.parentElement; }
    return {
      selector: buildSel(el),
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role"),
      type: el.getAttribute("type"),
      top: Math.round(r.top),
      height: Math.round(r.height),
      depth,
      text: text.slice(0, 180),
      textLength: text.length,
      name: el.getAttribute("name"),
      ariaLabel: el.getAttribute("aria-label"),
      placeholder: el.getAttribute("placeholder"),
      linkCount: el.querySelectorAll("a[href]").length,
      buttonCount: el.querySelectorAll('button,[role="button"]').length,
      blockCount: el.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li,blockquote,pre").length,
      childCount: el.children.length,
      inputLike: ["input","textarea","select"].includes(el.tagName.toLowerCase()) || el.isContentEditable,
      buttonLike: el.tagName.toLowerCase() === "button" || el.getAttribute("role") === "button",
      contentEditable: el instanceof HTMLElement && el.isContentEditable,
      disabled: el instanceof HTMLElement && (el.disabled || el.getAttribute("aria-disabled") === "true"),
      fingerprint: btoa(buildSel(el)).slice(0, 16),
      ...extra,
    };
  }

  const all = Array.from(document.querySelectorAll("*")).filter(isVis);

  // Editables
  const editables = [];
  for (const el of all) {
    const tag = el.tagName.toLowerCase();
    if (["input","textarea"].includes(tag) || (el instanceof HTMLElement && el.isContentEditable && el.getAttribute("role") !== "presentation")) {
      editables.push(toC(el));
    }
  }

  // Buttons
  const buttons = [];
  for (const el of all) {
    const tag = el.tagName.toLowerCase();
    if (tag === "button" || el.getAttribute("role") === "button") {
      buttons.push(toC(el));
    }
  }

  // Content (divs/sections with substantial text, no editable children)
  const content = [];
  const visited = new Set();
  for (const el of all) {
    const tag = el.tagName.toLowerCase();
    if (!["div","section","article","main","aside"].includes(tag)) continue;
    const tl = textOf(el).length;
    if (tl < 50) continue;
    if (el.querySelectorAll('[contenteditable="true"],input,textarea').length > 0) continue;
    const sel = buildSel(el);
    if (visited.has(sel)) continue;
    visited.add(sel);
    const r = el.getBoundingClientRect();
    if (r.height < 40) continue;
    content.push(toC(el));
  }
  content.sort((a, b) => b.textLength - a.textLength);

  // Groups
  const groups = [];
  for (const parent of all) {
    const children = Array.from(parent.children).filter(isVis);
    if (children.length < 2 || children.length > 50) continue;
    const sigs = new Map();
    for (const child of children) {
      const key = [child.tagName.toLowerCase(), child.getAttribute("role") || "", stableClasses(child).slice(0,2).join(".")].join("|");
      const list = sigs.get(key) ?? [];
      list.push(child);
      sigs.set(key, list);
    }
    for (const items of sigs.values()) {
      if (items.length < 2 || items.length > 50) continue;
      const sample = items[0];
      const cls = stableClasses(sample).slice(0, 2);
      const groupSel = cls.length > 0 ? `${sample.tagName.toLowerCase()}${cls.map(t => `.${esc(t)}`).join("")}` : `${buildSel(parent)} > ${sample.tagName.toLowerCase()}`;
      const sampleItems = items.slice(0, 3).map(it => ({
        text: textOf(it).slice(0, 180),
        linkCount: it.querySelectorAll("a[href]").length,
        buttonCount: it.querySelectorAll('button,[role="button"]').length,
      }));
      groups.push(toC(sample, {
        selector: groupSel,
        groupCount: items.length,
        sampleItems,
        text: sampleItems.map(i => i.text).join(" | ").slice(0, 320),
        textLength: sampleItems.reduce((s, i) => s + i.text.length, 0),
      }));
    }
  }
  groups.sort((a, b) => (b.groupCount ?? 0) - (a.groupCount ?? 0));

  const limits = {
    compose: { editables: 10, buttons: 6, content: 4, groups: 4 },
    response: { editables: 4, buttons: 12, content: 14, groups: 10 },
    sources: { editables: 2, buttons: 6, content: 10, groups: 10 },
  };
  const lim = limits[stage] ?? limits.response;

  return {
    stage,
    url: window.location.href,
    title: document.title || "",
    editables: editables.slice(0, lim.editables),
    buttons: buttons.slice(0, lim.buttons),
    content: content.slice(0, lim.content),
    groups: groups.slice(0, lim.groups),
  };
}
