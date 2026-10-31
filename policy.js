export const WEB_SCHEMES = new Set([
  "http", "https", "about", "blob", "data", "javascript", "file", "ws", "wss",
  "chrome", "chrome-extension", "view-source", "edge", "brave",
]);

export const EXCLUDED_SCHEMES = new Set(["mailto", "tel", "sms", "callto", "magnet"]);

const TWO_LEVEL_SUFFIXES = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.jp",
  "ne.jp", "or.jp", "com.br", "com.cn", "com.tr", "com.ua", "co.in", "co.kr",
  "co.nz", "co.za", "com.mx", "com.ar", "com.sg", "com.hk", "com.tw", "co.il",
]);

const OAUTH_ENDPOINTS = [
  { host: "accounts.google.com", path: "/" },
  { host: "login.microsoftonline.com", path: "/" },
  { host: "login.live.com", path: "/" },
  { host: "appleid.apple.com", path: "/" },
  { host: "github.com", path: "/login/oauth/" },
];

export function siteOf(url) {
  let host;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    host = u.hostname.replace(/\.$/, "").toLowerCase();
  } catch {
    return "";
  }
  if (/^[\d.]+$/.test(host) || host.includes(":")) return host;
  const labels = host.split(".");
  const keep = TWO_LEVEL_SUFFIXES.has(labels.slice(-2).join(".")) ? 3 : 2;
  return labels.slice(-keep).join(".");
}

export function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function schemeOf(url) {
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(url ?? "");
  return m ? m[1].toLowerCase() : "";
}

export function isOAuthEndpoint(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return OAUTH_ENDPOINTS.some((e) => u.hostname === e.host && u.pathname.startsWith(e.path));
}

export function newTabState() {
  return { landing: "", locked: false };
}

export function trackCommit(state, { url, qualifiers = [] }) {
  const site = siteOf(url);
  if (!site) return state;
  if (!state.landing) return { ...state, landing: site };
  if (state.locked) return state;
  if (qualifiers.includes("client_redirect")) return { ...state, landing: site };
  return { ...state, locked: true };
}

export function decide({ settings, tab, tabUrl, sourceUrl, scheme, via }) {
  scheme = (scheme || "").toLowerCase();
  if (!settings.enabled) return no("disabled");
  if (!scheme || WEB_SCHEMES.has(scheme)) return no("web scheme");
  if (EXCLUDED_SCHEMES.has(scheme)) return no("excluded scheme");
  if (!tab) return no("tab opened before the extension was watching");

  const host = hostOf(tabUrl) || hostOf(sourceUrl);
  if (host && settings.pausedSites.includes(host)) return no("site paused");

  if (via === "redirect" && isOAuthEndpoint(sourceUrl)) return yes("login redirect into app");

  const landing = tab.landing || siteOf(sourceUrl);
  const source = siteOf(sourceUrl);
  if (!source) return no("unknown source");
  if (source !== landing) return no(`launched from ${source}, tab landed on ${landing}`);
  return yes("launched from landing site");
}

const yes = (reason) => ({ close: true, reason });
const no = (reason) => ({ close: false, reason });
