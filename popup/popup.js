import { getSettings, setSettings } from "../settings.js";

const $ = (id) => document.getElementById(id);
const settings = await getSettings();

$("enabled").checked = settings.enabled;
$("enabled").addEventListener("change", (e) => setSettings({ enabled: e.target.checked }));

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
let host = "";
try {
  const url = new URL(tab?.url ?? "");
  if (url.protocol.startsWith("http")) host = url.hostname;
} catch {}

const pauseButton = $("pause");
const paused = new Set(settings.pausedSites);
function renderPause() {
  if (!host) {
    pauseButton.textContent = "Not available on this page";
    pauseButton.disabled = true;
    return;
  }
  pauseButton.textContent = paused.has(host) ? "Turn on on this page" : "Turn off on this page";
}
pauseButton.addEventListener("click", () => {
  paused.has(host) ? paused.delete(host) : paused.add(host);
  setSettings({ pausedSites: [...paused] });
  renderPause();
});
renderPause();

const { closedCount = 0, recent = [] } = await chrome.storage.local.get(["closedCount", "recent"]);
$("count").textContent = closedCount;
for (const item of recent) {
  const li = document.createElement("li");
  const what = document.createElement("span");
  what.textContent = item.host || "tab";
  const scheme = document.createElement("code");
  scheme.textContent = `${item.scheme}://`;
  li.append(what, scheme);
  $("recent").append(li);
}
