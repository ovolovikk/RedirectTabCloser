export const DEFAULTS = {
  enabled: true,
  pausedSites: [],
};

export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

export function setSettings(patch) {
  return chrome.storage.sync.set(patch);
}
