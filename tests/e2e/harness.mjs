import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter(Boolean);

function page(body) {
  return `<!doctype html><meta charset="utf-8"><body>${body}</body>`;
}

export const TEST_SCHEME_PREFIX = "rtctest-";

function route(url) {
  const q = url.searchParams;
  const s = TEST_SCHEME_PREFIX + (q.get("s") || "zoom");
  const delay = Number(q.get("delay") || 150);
  const app = `${s}://launch/${q.get("id") || ""}`;
  const later = (code) => `<script>setTimeout(() => { ${code} }, ${delay})</script>`;
  switch (url.pathname) {
    case "/plain":
      return { body: page("<p>nothing to see</p>") };
    case "/launch-nav":
      return { body: page(later(`location.href = ${JSON.stringify(app)}`)) };
    case "/launch-assign":
      return { body: page(later(`location.assign(${JSON.stringify(app)})`)) };
    case "/launch-iframe":
      return { body: page(later(`const f = document.createElement('iframe'); f.style.display = 'none'; f.src = ${JSON.stringify(app)}; document.body.append(f)`)) };
    case "/launch-iframe-html":
      return { body: page(later(`document.body.insertAdjacentHTML('beforeend', '<iframe hidden src=${JSON.stringify(app)}></iframe>')`)) };
    case "/launch-open":
      return { body: page(later(`window.open(${JSON.stringify(app)}, '_self')`)) };
    case "/launch-click":
      return { body: page(`<a id="a" href=${JSON.stringify(app)}>open</a>` + later(`document.getElementById('a').click()`)) };
    case "/launch-meta":
      return { body: page(`<meta http-equiv="refresh" content="0;url=${app}">`) };
    case "/launch-form":
      return { body: page(`<form id="f" action=${JSON.stringify(app)}></form>` + later(`document.getElementById('f').submit()`)) };
    case "/frame-host":
      return { body: page(`<iframe src="${q.get("frame")}"></iframe>`) };
    case "/redirect-app":
      return { status: 302, headers: { Location: app } };
    case "/redirect-to":
      if (!q.get("u")?.startsWith("https://")) return { status: 400, body: "https only" };
      return { status: 302, headers: { Location: q.get("u") } };
    case "/js-redirect":
      if (!q.get("u")?.startsWith("https://")) return { status: 400, body: "https only" };
      return { body: page(`<script>location.replace(${JSON.stringify(q.get("u"))})</script>`) };
    default:
      return { status: 404, body: "not found" };
  }
}

export async function startSite() {
  const dir = mkdtempSync(join(tmpdir(), "rtc-cert-"));
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=test",
    "-keyout", join(dir, "key.pem"), "-out", join(dir, "cert.pem"),
  ], { stdio: "ignore" });
  const server = createServer(
    { key: readFileSync(join(dir, "key.pem")), cert: readFileSync(join(dir, "cert.pem")) },
    (req, res) => {
      const r = route(new URL(req.url, `https://${req.headers.host}`));
      res.writeHead(r.status || 200, { "Content-Type": "text/html", "Cache-Control": "no-store", ...r.headers });
      res.end(r.body || "");
    },
  );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  rmSync(dir, { recursive: true, force: true });
  return { port: server.address().port, close: () => server.close() };
}

export function assertNoAppHandles(schemes) {
  if (process.platform !== "darwin") return;
  const script = `
    ObjC.import("AppKit");
    const schemes = ${JSON.stringify(schemes)};
    schemes.filter((s) => {
      const url = $.NSURL.URLWithString(s + "://probe");
      return !$.NSWorkspace.sharedWorkspace.URLForApplicationToOpenURL(url).isNil();
    }).join(",");`;
  const handled = execFileSync("osascript", ["-l", "JavaScript", "-e", script]).toString().trim();
  if (handled) throw new Error(`refusing to run: an app is registered for ${handled}`);
}

export async function launchChrome({ extensionPath, headless = true }) {
  const chromePath = CHROME_CANDIDATES.find((p) => {
    try {
      execFileSync("test", ["-x", p]);
      return true;
    } catch {
      return false;
    }
  });
  if (!chromePath) throw new Error("Chrome not found; set CHROME_PATH");

  const profile = mkdtempSync(join(tmpdir(), "rtc-profile-"));
  const args = [
    `--user-data-dir=${profile}`,
    "--remote-debugging-pipe",
    "--enable-unsafe-extension-debugging",
    "--host-resolver-rules=MAP * 127.0.0.1, EXCLUDE localhost",
    "--ignore-certificate-errors",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    ...(headless ? ["--headless=new"] : []),
    "about:blank",
  ];
  const proc = spawn(chromePath, args, { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
  const cdp = new PipeCDP(proc.stdio[3], proc.stdio[4]);
  const { id } = await cdp.send("Extensions.loadUnpacked", { path: extensionPath });

  return {
    cdp,
    extensionId: id,
    async close() {
      await cdp.send("Browser.close").catch(() => {});
      await sleep(300);
      proc.kill();
      rmSync(profile, { recursive: true, force: true });
    },
  };
}

class PipeCDP {
  constructor(writable, readable) {
    this.out = writable;
    this.nextId = 1;
    this.waits = new Map();
    let buffer = "";
    readable.on("data", (chunk) => {
      buffer += chunk.toString();
      let end;
      while ((end = buffer.indexOf("\0")) >= 0) {
        const msg = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        const w = msg.id && this.waits.get(msg.id);
        if (!w) continue;
        this.waits.delete(msg.id);
        msg.error ? w.reject(new Error(`${w.method}: ${msg.error.message}`)) : w.resolve(msg.result);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    this.out.write(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }) + "\0");
    return new Promise((resolve, reject) => this.waits.set(id, { resolve, reject, method }));
  }
  async attach(targetId) {
    const { sessionId } = await this.send("Target.attachToTarget", { targetId, flatten: true });
    return sessionId;
  }
  async evaluate(sessionId, expression) {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (r.exceptionDetails) throw new Error(`evaluate failed: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result.value;
  }
}
