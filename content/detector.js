(() => {
  const WEB_SCHEMES = new Set([
    "http:", "https:", "about:", "blob:", "data:", "javascript:", "file:",
    "ws:", "wss:", "chrome:", "chrome-extension:", "view-source:",
  ]);
  const reported = new Set();

  function report(rawUrl, via) {
    let url;
    try {
      url = new URL(rawUrl, location.href);
    } catch {
      return;
    }
    if (WEB_SCHEMES.has(url.protocol)) return;
    if (reported.has(url.protocol)) return;
    reported.add(url.protocol);
    chrome.runtime
      .sendMessage({ type: "launch", scheme: url.protocol.slice(0, -1), via })
      .catch(() => {});
  }

  if (window.navigation) {
    window.navigation.addEventListener("navigate", (e) => {
      report(e.destination.url, "navigate");
    });
  }

  document.addEventListener(
    "click",
    (e) => {
      const link = e.target instanceof Element && e.target.closest("a[href]");
      if (link) report(link.href, "click");
    },
    true,
  );

  document.addEventListener("redirect-tab-closer:launch", (e) => {
    if (typeof e.detail === "string") report(e.detail, "window.open");
  });

  const checkIframe = (node) => {
    if (node instanceof HTMLIFrameElement && node.src) report(node.src, "iframe");
  };
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes") {
        checkIframe(m.target);
        continue;
      }
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        checkIframe(node);
        node.querySelectorAll?.("iframe[src]").forEach(checkIframe);
      }
    }
  }).observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"],
  });
})();
