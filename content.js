"use strict";

// Matches Cyrillic, Cyrillic Supplement, Cyrillic Extended-A/B blocks
const CYRILLIC_RE = /[Ѐ-ӿԀ-ԯⷠ-ⷿꙀ-ꚟ]/;

function findAnchor(el) {
  while (el && el.tagName !== "A") {
    el = el.parentElement;
  }
  return el ? el : null;
}

function checkUrl(rawHref) {
  if (!rawHref) return null;

  const lower = rawHref.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("mailto:") ||
    lower.startsWith("tel:")
  ) {
    return null;
  }

  // Parse to validate URL and extract components
  let url;
  try {
    url = new URL(rawHref, document.baseURI);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  // Check raw href for Cyrillic characters (before browser punycode-encodes domain)
  if (CYRILLIC_RE.test(rawHref)) {
    alert("⚠️ URL 中包含西里尔字母，已阻止跳转。\n\n" + url.href);
    return null;
  }

  // Also check parsed URL's search params (browser preserves Unicode there)
  if (url.search && CYRILLIC_RE.test(url.search)) {
    alert("⚠️ URL 中包含西里尔字母，已阻止跳转。\n\n" + url.href);
    return null;
  }

  const hostname = url.hostname;
  const parts = hostname.split(".");
  const tld = parts.length > 1 ? "." + parts[parts.length - 1] : hostname;

  if (!confirm("即将跳转至顶级域名：" + tld + "\n\n是否继续？")) {
    return null;
  }

  return url.href;
}

document.addEventListener(
  "click",
  function (e) {
    if (e.button !== 0) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    var anchor = findAnchor(e.target);
    if (!anchor) return;

    var rawHref = anchor.getAttribute("href");
    if (!rawHref) return;

    // Only intercept http/https links; let javascript:, mailto:, tel:, anchors pass through
    var parsed;
    try {
      parsed = new URL(rawHref, document.baseURI);
    } catch {
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;

    // Check for Cyrillic characters
    var hasCyrillic =
      CYRILLIC_RE.test(rawHref) ||
      (parsed.search && CYRILLIC_RE.test(parsed.search));
    if (hasCyrillic) {
      e.preventDefault();
      alert("⚠️ URL 中包含西里尔字母，已阻止跳转。\n\n" + parsed.href);
      return;
    }

    // Show TLD confirmation
    var hostname = parsed.hostname;
    var parts = hostname.split(".");
    var tld = parts.length > 1 ? "." + parts[parts.length - 1] : hostname;

    e.preventDefault();
    if (!confirm("即将跳转至顶级域名：" + tld + "\n\n是否继续？")) {
      return;
    }

    if (anchor.target === "_blank") {
      chrome.runtime.sendMessage({ action: "openTab", url: parsed.href });
    } else {
      window.location.href = parsed.href;
    }
  },
  true
);
