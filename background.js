import { getSettings } from "./settings.js";
import { decide, hostOf, newTabState, schemeOf, trackCommit } from "./policy.js";

const ARM_WINDOW_MS = 30_000;
const CLOSE_DELAY_MS = 300;
const RECENT_BLUR_MS = 3_000;
const LOG_SIZE = 100;

let pending = Promise.resolve();
async function sessionMap(key) {
  await pending;
  return (await chrome.storage.session.get({ [key]: {} }))[key];
}
function updateSession(key, fallback, fn) {
  pending = pending.then(async () => {
    const value = (await chrome.storage.session.get({ [key]: fallback }))[key];
    const next = fn(value);
    await chrome.storage.session.set({ [key]: next === undefined ? value : next });
  });
  return pending;
}
const updateSessionMap = (key, fn) => updateSession(key, {}, fn);

chrome.tabs.onCreated.addListener((tab) => {
  updateSessionMap("tabs", (m) => void (m[tab.id] = newTabState()));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  updateSessionMap("tabs", (m) => void delete m[tabId]);
  updateSessionMap("armed", (m) => void delete m[tabId]);
});

chrome.tabs.onReplaced.addListener((addedId, removedId) => {
  updateSessionMap("tabs", (m) => {
    if (m[removedId]) m[addedId] = m[removedId];
    delete m[removedId];
  });
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  updateSessionMap("tabs", (m) => {
    const state = m[details.tabId];
    if (state) m[details.tabId] = trackCommit(state, { url: details.url, qualifiers: details.transitionQualifiers });
  });
});

async function onLaunch({ tabId, scheme, sourceUrl, via }) {
  if (tabId == null || tabId < 0) return;

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return;
  }
  const settings = await getSettings();
  const state = (await sessionMap("tabs"))[tabId];
  const tabUrl = tab.url || tab.pendingUrl || "";
  const verdict = decide({ settings, tab: state, tabUrl, sourceUrl, scheme, via });
  await log({ tabId, scheme, via, sourceUrl, ...verdict });
  if (!verdict.close) return;

  await updateSessionMap("armed", (m) => void (m[tabId] = { at: Date.now(), scheme, host: hostOf(tabUrl || sourceUrl) }));

  const win = await chrome.windows.get(tab.windowId).catch(() => null);
  const { lastBlurAt = 0 } = await chrome.storage.session.get("lastBlurAt");
  if (win && !win.focused && Date.now() - lastBlurAt < RECENT_BLUR_MS) {
    setTimeout(() => closeIfArmed(tabId), CLOSE_DELAY_MS);
  }
}

function log(entry) {
  return updateSession("log", [], (list) => [{ at: Date.now(), ...entry }, ...list].slice(0, LOG_SIZE));
}

async function closeIfArmed(tabId) {
  const entry = (await sessionMap("armed"))[tabId];
  if (!entry || Date.now() - entry.at > ARM_WINDOW_MS) return;
  await updateSessionMap("armed", (m) => void delete m[tabId]);

  let tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return;
  }

  const siblings = await chrome.tabs.query({ windowId: tab.windowId });
  if (siblings.length === 1) {
    await chrome.tabs.create({ windowId: tab.windowId, active: true });
  }
  await chrome.tabs.remove(tabId).catch(() => {});
  await recordClose(entry);
}

function recordClose({ scheme, host }) {
  pending = pending.then(async () => {
    const { closedCount = 0, recent = [] } = await chrome.storage.local.get(["closedCount", "recent"]);
    recent.unshift({ scheme, host, at: Date.now() });
    await chrome.storage.local.set({ closedCount: closedCount + 1, recent: recent.slice(0, 5) });
  });
  return pending;
}

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) return;
  chrome.storage.session.set({ lastBlurAt: Date.now() });
  const armed = await sessionMap("armed");
  for (const tabId of Object.keys(armed)) {
    setTimeout(() => closeIfArmed(Number(tabId)), CLOSE_DELAY_MS);
  }
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "launch" && sender.tab) {
    onLaunch({ tabId: sender.tab.id, scheme: msg.scheme, sourceUrl: sender.url, via: msg.via });
  }
});

chrome.webRequest.onBeforeRedirect.addListener(
  (details) => {
    const scheme = schemeOf(details.redirectUrl);
    if (scheme === "http" || scheme === "https") return;
    onLaunch({ tabId: details.tabId, scheme, sourceUrl: details.url, via: "redirect" });
  },
  { urls: ["<all_urls>"], types: ["main_frame", "sub_frame"] },
);
