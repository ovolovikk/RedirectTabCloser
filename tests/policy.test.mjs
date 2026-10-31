import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { decide, isOAuthEndpoint, newTabState, schemeOf, siteOf, trackCommit } from "../policy.js";
import { DEFAULTS } from "../settings.js";


function tabAfter(commits) {
  let state = newTabState();
  for (const c of commits) {
    state = trackCommit(state, typeof c === "string" ? { url: c } : c);
  }
  return state;
}
const redirect = (url) => ({ url, qualifiers: ["server_redirect"] });
const clientRedirect = (url) => ({ url, qualifiers: ["client_redirect"] });

function verdict(overrides) {
  return decide({
    settings: { ...DEFAULTS, ...overrides.settings },
    tab: overrides.tab,
    tabUrl: overrides.tabUrl ?? overrides.sourceUrl,
    sourceUrl: overrides.sourceUrl,
    scheme: "scheme" in overrides ? overrides.scheme : "zoommtg",
    via: overrides.via ?? "navigate",
  });
}

describe("siteOf", () => {
  const cases = [
    ["https://zoom.us/j/123", "zoom.us"],
    ["https://us02web.zoom.us/j/123?pwd=x", "zoom.us"],
    ["https://discord.com/invite/abc", "discord.com"],
    ["https://www.bbc.co.uk/news", "bbc.co.uk"],
    ["https://shop.example.co.uk/", "example.co.uk"],
    ["https://example.com.au/", "example.com.au"],
    ["http://127.0.0.1:8765/x", "127.0.0.1"],
    ["http://localhost:3000/", "localhost"],
    ["http://[::1]:8080/", "[::1]"],
    ["https://Claude.AI./login", "claude.ai"],
    ["chrome://newtab/", ""],
    ["about:blank", ""],
    ["zoommtg://zoom.us/join", ""],
    ["not a url", ""],
    [undefined, ""],
  ];
  for (const [url, site] of cases) {
    test(`${url} -> ${JSON.stringify(site)}`, () => assert.equal(siteOf(url), site));
  }
});

describe("schemeOf", () => {
  test("app schemes", () => {
    assert.equal(schemeOf("zoommtg://zoom.us/join"), "zoommtg");
    assert.equal(schemeOf("ms-teams:/l/meetup"), "ms-teams");
    assert.equal(schemeOf("MAILTO:a@b.c"), "mailto");
    assert.equal(schemeOf("vscode-insiders://x"), "vscode-insiders");
  });
  test("garbage", () => {
    assert.equal(schemeOf(""), "");
    assert.equal(schemeOf("/relative/path"), "");
    assert.equal(schemeOf(undefined), "");
  });
});

describe("isOAuthEndpoint", () => {
  test("known login pages", () => {
    assert.ok(isOAuthEndpoint("https://accounts.google.com/o/oauth2/v2/auth?x=1"));
    assert.ok(isOAuthEndpoint("https://login.microsoftonline.com/common/oauth2"));
    assert.ok(isOAuthEndpoint("https://github.com/login/oauth/authorize"));
  });
  test("lookalikes and unrelated pages", () => {
    assert.ok(!isOAuthEndpoint("https://github.com/anthropics/claude-code"));
    assert.ok(!isOAuthEndpoint("https://accounts.google.com.evil.test/"));
    assert.ok(!isOAuthEndpoint("https://mail.google.com/"));
    assert.ok(!isOAuthEndpoint("nonsense"));
  });
});

describe("trackCommit: landing site", () => {
  test("first web page becomes the landing site", () => {
    assert.equal(tabAfter(["https://zoom.us/j/1"]).landing, "zoom.us");
  });
  test("new tab page is skipped", () => {
    const t = tabAfter(["chrome://newtab/", "https://zoom.us/j/1"]);
    assert.equal(t.landing, "zoom.us");
    assert.equal(t.locked, false);
  });
  test("first request's server redirect is the landing site", () => {
    const t = tabAfter([redirect("https://zoom.us/j/1")]);
    assert.equal(t.landing, "zoom.us");
    assert.equal(t.locked, false);
  });
  test("you clicked a link that got server-redirected: locks, landing stays", () => {
    const t = tabAfter(["https://docs.test/", { url: "https://zoom.us/j/1", qualifiers: ["server_redirect"] }]);
    assert.equal(t.landing, "docs.test");
    assert.equal(t.locked, true);
  });
  test("client redirect right after landing moves it", () => {
    const t = tabAfter(["https://t.co/x", clientRedirect("https://discord.com/invite/a")]);
    assert.equal(t.landing, "discord.com");
  });
  test("client redirect whose target was server-redirected still moves it", () => {
    const t = tabAfter(["https://t.co/x", { url: "https://discord.com/invite/a", qualifiers: ["client_redirect", "server_redirect"] }]);
    assert.equal(t.landing, "discord.com");
  });
  test("chain of client redirects", () => {
    const t = tabAfter(["https://a.test/", clientRedirect("https://b.test/"), clientRedirect("https://c.test/")]);
    assert.equal(t.landing, "c.test");
  });
  test("a normal navigation locks the landing site", () => {
    const t = tabAfter(["https://google.com/search?q=zoom", "https://zoom.us/j/1"]);
    assert.equal(t.landing, "google.com");
    assert.equal(t.locked, true);
  });
  test("redirects after the lock don't move it", () => {
    const t = tabAfter(["https://google.com/", "https://news.test/", redirect("https://zoom.us/j/1")]);
    assert.equal(t.landing, "google.com");
  });
  test("same-site navigation also locks", () => {
    const t = tabAfter(["https://zoom.us/", "https://zoom.us/j/1", redirect("https://evil.test/")]);
    assert.equal(t.landing, "zoom.us");
    assert.equal(t.locked, true);
  });
  test("non-web commits don't lock", () => {
    const t = tabAfter(["https://a.test/", "about:blank", clientRedirect("https://b.test/")]);
    assert.equal(t.landing, "b.test");
  });
});

describe("decide: closes", () => {
  test("Zoom link opened in a new tab", () => {
    const tab = tabAfter(["https://us02web.zoom.us/j/123"]);
    const v = verdict({ tab, sourceUrl: "https://us02web.zoom.us/j/123#success" });
    assert.equal(v.close, true, v.reason);
  });
  test("Discord invite via discord.gg redirect", () => {
    const tab = tabAfter([redirect("https://discord.com/invite/abc")]);
    const v = verdict({ tab, scheme: "discord", sourceUrl: "https://discord.com/invite/abc" });
    assert.equal(v.close, true, v.reason);
  });
  test("Discord channel link, user clicks 'Open App' inside the web app", () => {
    const tab = tabAfter(["https://discord.com/channels/1/2"]);
    const v = verdict({ tab, scheme: "discord", via: "click", sourceUrl: "https://discord.com/channels/1/2" });
    assert.equal(v.close, true, v.reason);
  });
  test("tab typed into from the new tab page", () => {
    const tab = tabAfter(["chrome://newtab/", "https://zoom.us/j/9"]);
    assert.equal(verdict({ tab, sourceUrl: "https://zoom.us/j/9" }).close, true);
  });
  test("Claude desktop login: claude.ai -> Google -> back to claude.ai -> claude://", () => {
    const tab = tabAfter([
      "https://claude.ai/login?from=desktop",
      "https://accounts.google.com/o/oauth2/auth",
      redirect("https://claude.ai/api/auth/callback"),
    ]);
    const v = verdict({ tab, scheme: "claude", sourceUrl: "https://claude.ai/api/auth/callback" });
    assert.equal(v.close, true, v.reason);
  });
  test("server redirect into the app answered by the tab's very first request", () => {
    const tab = tabAfter([]);
    const v = verdict({ tab, scheme: "claude", via: "redirect", sourceUrl: "https://claude.ai/desktop/open" });
    assert.equal(v.close, true, v.reason);
  });
  test("Google redirects straight into the app (redirect_uri=app://)", () => {
    const tab = tabAfter(["https://cursor.com/login", "https://accounts.google.com/o/oauth2/auth"]);
    const v = verdict({
      tab, scheme: "cursor", via: "redirect",
      tabUrl: "https://accounts.google.com/o/oauth2/auth",
      sourceUrl: "https://accounts.google.com/o/oauth2/auth?code=1",
    });
    assert.equal(v.close, true, v.reason);
  });
  test("iframe on the landing site", () => {
    const tab = tabAfter(["https://zoom.us/j/1"]);
    const v = verdict({ tab, via: "iframe", tabUrl: "https://zoom.us/j/1", sourceUrl: "https://zoom.us/j/1" });
    assert.equal(v.close, true);
  });
  test("subdomain of the landing site", () => {
    const tab = tabAfter(["https://zoom.us/j/1", redirect("https://us05web.zoom.us/j/1")]);
    assert.equal(verdict({ tab, sourceUrl: "https://app.zoom.us/wc/1" }).close, true);
  });
  test("scheme case doesn't matter", () => {
    const tab = tabAfter(["https://zoom.us/j/1"]);
    assert.equal(verdict({ tab, scheme: "ZoomMtg", sourceUrl: "https://zoom.us/j/1" }).close, true);
  });
});

describe("decide: keeps the tab", () => {
  test("you searched, then clicked a Zoom link in the same tab", () => {
    const tab = tabAfter(["https://google.com/search?q=standup", "https://zoom.us/j/1"]);
    const v = verdict({ tab, sourceUrl: "https://zoom.us/j/1" });
    assert.equal(v.close, false);
    assert.match(v.reason, /landed on google\.com/);
  });
  test("you were reading a site and clicked 'Open in Slack'", () => {
    const tab = tabAfter(["https://news.test/article"]);
    const v = verdict({ tab, scheme: "slack", via: "redirect", sourceUrl: "https://slack.com/app_redirect?channel=x" });
    assert.equal(v.close, false);
  });
  test("navigated to a link that redirected to Zoom", () => {
    const tab = tabAfter(["https://docs.test/", redirect("https://zoom.us/j/1")]);
    assert.equal(verdict({ tab, sourceUrl: "https://zoom.us/j/1" }).close, false);
  });
  test("navigated from docs to Zoom in the same tab", () => {
    const tab = tabAfter(["https://docs.test/", "https://zoom.us/j/1"]);
    assert.equal(verdict({ tab, sourceUrl: "https://zoom.us/j/1" }).close, false);
  });
  test("cross-site ad iframe tries to open an app", () => {
    const tab = tabAfter(["https://news.test/"]);
    const v = verdict({ tab, via: "iframe", tabUrl: "https://news.test/", sourceUrl: "https://ads.example/frame" });
    assert.equal(v.close, false);
  });
  test("a tab opened long ago still closes from its landing site (no age limit)", () => {
    const tab = tabAfter(["https://zoom.us/j/1"]);
    assert.equal(verdict({ tab, sourceUrl: "https://zoom.us/j/1" }).close, true);
  });
  test("tab that existed before the extension (no state)", () => {
    assert.equal(verdict({ tab: undefined, sourceUrl: "https://zoom.us/j/1" }).close, false);
  });
  for (const scheme of ["mailto", "tel", "sms", "callto", "magnet"]) {
    test(`excluded scheme ${scheme}:`, () => {
      const tab = tabAfter(["https://zoom.us/"]);
      assert.equal(verdict({ tab, scheme, sourceUrl: "https://zoom.us/" }).reason, "excluded scheme");
    });
  }
  for (const scheme of ["http", "https", "about", "data", "blob", "javascript", "chrome", "", undefined]) {
    test(`web/empty scheme ${JSON.stringify(scheme)}`, () => {
      const tab = tabAfter(["https://zoom.us/"]);
      assert.equal(verdict({ tab, scheme, sourceUrl: "https://zoom.us/" }).close, false);
    });
  }
  test("extension disabled", () => {
    const tab = tabAfter(["https://zoom.us/j/1"]);
    assert.equal(verdict({ tab, settings: { enabled: false }, sourceUrl: "https://zoom.us/j/1" }).reason, "disabled");
  });
  test("site paused", () => {
    const tab = tabAfter(["https://zoom.us/j/1"]);
    const v = verdict({ tab, settings: { pausedSites: ["zoom.us"] }, sourceUrl: "https://zoom.us/j/1" });
    assert.equal(v.reason, "site paused");
  });
  test("non-OAuth redirect after you navigated away doesn't get the login exemption", () => {
    const tab = tabAfter(["https://google.com/", "https://github.com/some/repo"]);
    const v = verdict({ tab, scheme: "vscode", via: "redirect", sourceUrl: "https://github.com/some/repo/open" });
    assert.equal(v.close, false);
  });
  test("OAuth exemption only for server redirects, not page scripts", () => {
    const tab = tabAfter(["https://news.test/", "https://accounts.google.com/x"]);
    const v = verdict({ tab, via: "navigate", sourceUrl: "https://accounts.google.com/x" });
    assert.equal(v.close, false);
  });
});
