(() => {
  const originalOpen = window.open;
  window.open = function (url, ...rest) {
    try {
      if (url != null) {
        const href = new URL(String(url), location.href).href;
        document.dispatchEvent(new CustomEvent("redirect-tab-closer:launch", { detail: href }));
      }
    } catch {
    }
    return originalOpen.call(this, url, ...rest);
  };
})();
