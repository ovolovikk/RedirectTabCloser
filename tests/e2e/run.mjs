import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { assertNoAppHandles, launchChrome, sleep, startSite, TEST_SCHEME_PREFIX } from "./harness.mjs";

const extensionPath = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const APPS = ["zoom", "discord", "slack", "msteams", "claude", "cursor", "spotify", "mailto", "tel"];
assertNoAppHandles(APPS.map((a) => TEST_SCHEME_PREFIX + a));
const site = await startSite();
const browser = await launchChrome({ extensionPath, headless: !process.env.HEADFUL });
const { cdp, extensionId } = browser;

const [preexisting] = (await cdp.send("Target.getTargets")).targetInfos.filter((t) => t.type === "page");

let sw;
for (let i = 0; i < 40 && !sw; i++) {
  const { targetInfos } = await cdp.send("Target.getTargets");
  sw = targetInfos.find((t) => t.type === "service_worker" && t.url.startsWith(`chrome-extension://${extensionId}/`));
  if (!sw) await sleep(100);
}
if (!sw) throw new Error("extension service worker never started");
const swSession = await cdp.attach(sw.targetId);
const inSW = (js) => cdp.evaluate(swSession, js);
for (let i = 0; i < 50 && !(await inSW("typeof chrome !== 'undefined' && !!chrome.storage")); i++) await sleep(100);
const setSettings = (patch) => inSW(`chrome.storage.sync.set(${JSON.stringify(patch)})`);
const resetSettings = () => inSW(`chrome.storage.sync.clear()`);
const appTakesFocus = () => inSW(`chrome.windows.onFocusChanged.dispatch(chrome.windows.WINDOW_ID_NONE)`);

const url = (host, path, params = {}) =>
  `https://${host}:${site.port}${path}?${new URLSearchParams(params)}`;

async function open(u, { newWindow = false } = {}) {
  const { targetId } = await cdp.send("Target.createTarget", { url: u, newWindow });
  return targetId;
}
async function userNavigate(targetId, u) {
  const s = await cdp.attach(targetId);
  await cdp.send("Page.navigate", { url: u, transitionType: "link" }, s);
}
async function isOpen(targetId) {
  const { targetInfos } = await cdp.send("Target.getTargets");
  return targetInfos.some((t) => t.targetId === targetId);
}
const logFor = async (id) =>
  (await inSW(`chrome.storage.session.get('log').then((x) => x.log || [])`)).filter((e) => (e.sourceUrl || "").includes(`id=${id}`));

const CLOSE = "closed", KEEP = "kept open";

const freshTabScenarios = [
  ["Zoom: new tab, page sets location.href", CLOSE, (id) => open(url("zoom.test", "/launch-nav", { id }))],
  ["Zoom: subdomain page (us02web.zoom.test)", CLOSE, (id) => open(url("us02web.zoom.test", "/launch-nav", { id }))],
  ["location.assign()", CLOSE, (id) => open(url("zoom.test", "/launch-assign", { id }))],
  ["Discord: hidden iframe launch", CLOSE, (id) => open(url("discord.test", "/launch-iframe", { id, s: "discord" }))],
  ["iframe injected via innerHTML", CLOSE, (id) => open(url("discord.test", "/launch-iframe-html", { id, s: "discord" }))],
  ["Slack: window.open(app://)", CLOSE, (id) => open(url("slack.test", "/launch-open", { id, s: "slack" }))],
  ["Teams: programmatic <a> click", CLOSE, (id) => open(url("teams.test", "/launch-click", { id, s: "msteams" }))],
  ["meta refresh into app", CLOSE, (id) => open(url("zoom.test", "/launch-meta", { id }))],
  ["form submit into app", CLOSE, (id) => open(url("zoom.test", "/launch-form", { id }))],
  ["Claude: first request answers 302 claude://", CLOSE, (id) => open(url("claude.test", "/redirect-app", { id, s: "claude" }))],
  ["short link 302 -> Zoom page", CLOSE, (id) =>
    open(url("short.test", "/redirect-to", { u: url("zoom.test", "/launch-nav", { id }) }))],
  ["t.co-style JS redirect -> Discord page", CLOSE, (id) =>
    open(url("tco.test", "/js-redirect", { u: url("discord.test", "/launch-nav", { id, s: "discord" }) }))],
  ["new tab page, then typed Zoom URL", CLOSE, async (id) => {
    const t = await open("chrome://newtab/");
    await sleep(300);
    await userNavigate(t, url("zoom.test", "/launch-nav", { id }));
    return t;
  }],
  ["Claude login: claude -> Google -> 302 back to claude -> claude://", CLOSE, async (id) => {
    const t = await open(url("claude.test", "/plain", { id: `${id}-start` }));
    await sleep(400);
    await userNavigate(t, url("google-login.test", "/plain", { id: `${id}-google` }));
    await sleep(400);
    await userNavigate(t, url("google-login.test", "/redirect-to", { u: url("claude.test", "/launch-nav", { id, s: "claude" }) }));
    return t;
  }],
  ["Google login 302s straight to cursor://", CLOSE, async (id) => {
    const t = await open(url("cursor.test", "/plain", { id: `${id}-start` }));
    await sleep(400);
    await userNavigate(t, url("accounts.google.com", "/redirect-app", { id, s: "cursor" }));
    return t;
  }],
  ["Zoom landing, clicked through to join page (same site)", CLOSE, async (id) => {
    const t = await open(url("zoom.test", "/plain", { id: `${id}-start` }));
    await sleep(400);
    await userNavigate(t, url("zoom.test", "/launch-nav", { id }));
    return t;
  }],

  ["searched, then clicked a Zoom link in the same tab", KEEP, async (id) => {
    const t = await open(url("search.test", "/plain", { id: `${id}-start` }));
    await sleep(400);
    await userNavigate(t, url("zoom.test", "/launch-nav", { id }));
    return t;
  }],
  ["reading a site, clicked 'Open in Slack' (302 into app)", KEEP, async (id) => {
    const t = await open(url("news.test", "/plain", { id: `${id}-start` }));
    await sleep(400);
    await userNavigate(t, url("slack.test", "/redirect-app", { id, s: "slack" }));
    return t;
  }],
  ["navigated away, then a redirect chain lands on Zoom", KEEP, async (id) => {
    const t = await open(url("docs.test", "/plain", { id: `${id}-start` }));
    await sleep(400);
    await userNavigate(t, url("short.test", "/redirect-to", { u: url("zoom.test", "/launch-nav", { id }) }));
    return t;
  }],
  ["cross-site ad iframe tries to launch an app", KEEP, (id) =>
    open(url("news.test", "/frame-host", { id: `${id}-host`, frame: url("ads.test", "/launch-nav", { id }) }))],
  ["plain page, no launch", KEEP, (id) => open(url("plain.test", "/plain", { id }))],
  ["tab open before the extension, reused for a Zoom link", KEEP, async (id) => {
    await userNavigate(preexisting.targetId, url("zoom.test", "/launch-nav", { id }));
    return preexisting.targetId;
  }],
];

const results = [];
function record(name, expected, actual, log) {
  const ok = expected === actual;
  results.push({ name, ok, actual });
  const why = log.length ? ` — ${log.map((e) => `${e.via}: ${e.reason}`).join("; ")}` : " — (no launch seen)";
  console.log(`${ok ? "✔" : "✖"} ${name}: ${actual}${ok ? "" : ` (expected ${expected})`}${why}`);
}

async function runBatch(scenarios, waitMs = 2000) {
  const started = await Promise.all(
    scenarios.map(async ([name, expected, run], i) => {
      const id = `${Date.now().toString(36)}b${i}x`;
      return { name, expected, id, target: await run(id) };
    }),
  );
  await sleep(waitMs);
  await appTakesFocus();
  await sleep(1000);
  for (const s of started) {
    record(s.name, s.expected, (await isOpen(s.target)) ? KEEP : CLOSE, await logFor(s.id));
  }
}

let singleCount = 0;
async function single(name, expected, run, { focus = true } = {}) {
  const id = `${Date.now().toString(36)}s${++singleCount}x`;
  const target = await run(id);
  await sleep(1500);
  if (focus) await appTakesFocus();
  await sleep(1000);
  record(name, expected, (await isOpen(target)) ? KEEP : CLOSE, await logFor(id));
  return target;
}

try {
  console.log(`Chrome loaded extension ${extensionId}\n`);

  console.log("# Nothing closes until the app takes focus (Chrome's \"Open app?\" prompt must survive)");
  await resetSettings();
  const unfocused = await single("Zoom launch, app never took focus", KEEP, (id) => open(url("zoom.test", "/launch-nav", { id })), { focus: false });
  await cdp.send("Target.closeTarget", { targetId: unfocused });

  console.log("\n# The app takes focus");
  await runBatch(freshTabScenarios);

  console.log("\n# Window handling");
  {
    const id = `${Date.now().toString(36)}wx`;
    const target = await open(url("zoom.test", "/launch-nav", { id, delay: 800 }), { newWindow: true });
    await sleep(300);
    const windowId = await inSW(`chrome.tabs.query({}).then((ts) => ts.find((t) => (t.url || t.pendingUrl).includes('id=${id}'))?.windowId)`);
    await sleep(1500);
    await appTakesFocus();
    await sleep(1000);
    const left = await inSW(`chrome.tabs.query({ windowId: ${windowId} }).then((ts) => ts.length)`).catch(() => 0);
    record("last tab in a window: closed", CLOSE, (await isOpen(target)) ? KEEP : CLOSE, await logFor(id));
    record("…and the window survives with a new tab", "1 tab left", `${left} tab${left === 1 ? "" : "s"} left`, []);
  }

  console.log("\n# Popup controls");
  await setSettings({ pausedSites: ["zoom.test"] });
  await single("'Turn off on this page' for that site", KEEP, (id) => open(url("zoom.test", "/launch-nav", { id })));
  await setSettings({ pausedSites: [], enabled: false });
  await single("extension switched off", KEEP, (id) => open(url("zoom.test", "/launch-nav", { id })));
  await resetSettings();
  await single("…and back on", CLOSE, (id) => open(url("zoom.test", "/launch-nav", { id })));

  console.log("\n# Counter");
  const { closedCount } = await inSW(`chrome.storage.local.get('closedCount')`);
  const expectedClosed = results.filter((r) => r.actual === CLOSE).length;
  record("popup counter matches closed tabs", String(expectedClosed), String(closedCount), []);
} finally {
  await browser.close();
  site.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
