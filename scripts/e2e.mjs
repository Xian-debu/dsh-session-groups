#!/usr/bin/env node
/**
 * e2e.mjs — 「自定义分组」端到端冒烟（无头 Chrome + CDP，零依赖）
 *
 * 覆盖主路径：
 *   S1 页面就绪：侧栏存在会话行与 View options 按钮
 *   S2 切到 Custom groups（真实 UI 菜单），模式落盘
 *   S3 新建分组：header 出现、groups 落盘
 *   S4 改名：菜单 → Rename → 输入 → Enter，localStorage 与标题同步
 *   S5 行内「⋯」菜单归组：Move to group… → Modal 选组，assignment 落盘且行移入该组
 *   S6 再点菜单移出：Remove from custom group，assignment 清空
 *   S7 键盘折叠：焦点在分组头按 Enter ⇒ aria-expanded=false 且 collapsed 落盘；再按恢复
 *   S8 reload 后：模式仍为 custom、分组与名字保留
 *   S9 清理：还原 dsh.workspace.view.v5 / dsh.sessionGroups.v1 的本地快照
 *   0 console error / page exception
 *
 * 用法：
 *   node scripts/e2e.mjs --url "http://127.0.0.1:3099/?token=..."
 *   可选：--chrome <path>  --screenshots <dir>
 *
 * 需要一个已在运行的 dsh web 实例。建议用临时 profile 起的实例（不要指向生产 3080）；
 * 脚本会还原上述两个 localStorage 键，chrome profile 本身也是临时的。
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf("--" + name);
  if (i === -1) return fallback;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : true;
}
const URL_ARG = arg("url", process.env.DSH_E2E_URL);
if (!URL_ARG || URL_ARG === true) {
  console.error("用法: node scripts/e2e.mjs --url \"<dsh web token URL>\" [--chrome <bin>] [--screenshots <dir>]");
  process.exit(2);
}
const SHOT_DIR = arg("screenshots", null);
const CHROME = arg("chrome", process.env.CHROME_BIN) || ["/usr/bin/chromium", "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/google-chrome-stable"].find(existsSync) || "chromium";

const results = [];
const fail = (name, detail) => results.push({ ok: false, name, detail });
const pass = (name, detail) => results.push({ ok: true, name, detail: detail || "" });
function assert(name, ok, detail) {
  ok ? pass(name, detail) : fail(name, detail);
  console.log((ok ? "  ok   " : "  FAIL ") + name + (detail ? "  " + detail : ""));
}

let chromeProc = null;
let profileDir = null;

async function launchChrome(binary) {
  profileDir = mkdtempSync(join(tmpdir(), "dsh-e2e-"));
  const chromeArgs = [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--hide-scrollbars",
    "--mute-audio",
    "--no-first-run",
    "--remote-debugging-port=0",
    "--user-data-dir=" + profileDir,
    "--window-size=1440,900",
    "about:blank"
  ];
  chromeProc = spawn(binary, chromeArgs, { stdio: ["ignore", "ignore", "pipe"] });
  let buf = "";
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("chrome 未在 20s 内报告 DevTools 端点: " + buf.slice(-500))), 20000);
    chromeProc.stderr.on("data", (d) => {
      buf += String(d);
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    chromeProc.on("exit", (code) => { clearTimeout(timer); reject(new Error("chrome 提前退出 (" + code + "): " + buf.slice(-500))); });
  });
  const url = new URL(endpoint);
  // ws:// 的 origin 仍是 ws://（非 http 特殊 scheme），fetch 不认 → 显式换成 http。
  return { base: "http://" + url.host, browserWs: endpoint };
}

async function newTarget(base) {
  const res = await fetch(base + "/json/new?about:blank", { method: "PUT" });
  if (!res.ok) throw new Error("创建 target 失败: HTTP " + res.status);
  const t = await res.json();
  return await connectCdp(t.webSocketDebuggerUrl);
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.logs = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (p) { this.pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); }
      } else if (msg.method === "Runtime.consoleAPICalled") {
        this.logs.push({ type: msg.params.type, text: msg.params.args.map((a) => a.value ?? a.description ?? "").join(" ") });
      } else if (msg.method === "Runtime.exceptionThrown") {
        const d = msg.params.exceptionDetails;
        this.logs.push({ type: "exception", text: d.exception?.description ?? d.text });
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error("timeout " + method)); }, 20000);
      this.pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evalJs(expr) {
    const r = await this.send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }
  async key(key, code, text) {
    const info = { key, code, windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
    if (text) { info.text = text; info.unmodifiedText = text; }
    await this.send("Input.dispatchKeyEvent", { type: "keyDown", ...info });
    await this.send("Input.dispatchKeyEvent", { type: "keyUp", ...info });
  }
  async shot(file) {
    const r = await this.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(file, Buffer.from(r.data, "base64"));
  }
}

async function connectCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", () => reject(new Error("CDP WebSocket 连接失败")));
  });
  const cdp = new CDP(ws);
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  return cdp;
}

const HELPERS = 'window.__e2e = {' +
  '  ls: () => { try { return JSON.parse(localStorage.getItem("dsh.sessionGroups.v1")); } catch { return null; } },' +
  '  view: () => { try { return JSON.parse(localStorage.getItem("dsh.workspace.view.v5")); } catch { return null; } },' +
  '  rowKeys: () => [...document.querySelectorAll("[data-row-key]")].map((e) => e.getAttribute("data-row-key")),' +
  '  header: (gid) => document.querySelector("div[data-row-key=\'workspace:" + gid + "\']"),' +
  '  headerTitle: (gid) => { const h = window.__e2e.header(gid); const s = h && h.querySelector("span[class*=\'_title\']"); return s ? s.textContent.trim() : null; },' +
  '  headerActions: (gid) => { const h = window.__e2e.header(gid); return h ? [...h.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || "").startsWith("Group actions")) : null; },' +
  '  click: (el) => { if (!el) return false; el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); return true; },' +
  '  menuItems: () => [...document.querySelectorAll("[role=menuitem]")].map((e) => e.textContent.trim()),' +
  '  menuItemByText: (re) => [...document.querySelectorAll("[role=menuitem]")].find((e) => re.test(e.textContent.trim())) || null,' +
  '  sessionRows: () => [...document.querySelectorAll("[data-row-key^=\'session:\']")].filter((r) => r.querySelector("button[aria-label^=\'Session actions for\']")),' +
  '  pickSession: () => { const r = window.__e2e.sessionRows().find((x) => x.querySelector("button[aria-label=\'Pin session\']")); return r ? r.getAttribute("data-row-key").replace(/^session:/, "") : null; },' +
  '  openRowMenu: (sid) => { const r = document.querySelector("[data-row-key=\'session:" + sid + "\']"); const b = r && r.querySelector("button[aria-label^=\'Session actions for\']"); return window.__e2e.click(b); },' +
  '  sectionOf: (key) => { const row = document.querySelector("[data-row-key=\'" + key + "\']"); if (!row) return null; const y = row.getBoundingClientRect().y; const hs = [...document.querySelectorAll("div[data-row-key^=\'workspace:\']")].map((h) => ({ n: (h.querySelector("span[class*=\'_title\']") || {}).textContent, y: h.getBoundingClientRect().y })).filter((h) => h.y <= y + 3).sort((a, b) => b.y - a.y); return hs.length ? hs[0].n.trim() : null; },' +
  '  renameInput: () => document.querySelector("input[class*=\'_renameInput\']"),' +
  '  setInput: (v) => { const i = window.__e2e.renameInput(); if (!i) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, v); i.dispatchEvent(new Event("input", { bubbles: true })); return true; },' +
  '  press: (el, key) => { if (!el) return false; el.focus(); el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })); return true; },' +
  '  moveOptions: () => [...document.querySelectorAll("[data-move-option]")].map((e) => ({ v: e.getAttribute("data-move-option"), t: e.textContent.trim() })),' +
  '  chooseMove: (v) => { const el = document.querySelector("[data-move-option=\'" + v + "\']"); return window.__e2e.click(el); }' +
  '};';

async function main() {
  console.log("== dsh-session-groups e2e ==");
  console.log("chrome:", CHROME);
  const target = await launchChrome(CHROME);
  const cdp = await newTarget(target.base);
  try {
    await cdp.send("Page.bringToFront");
    await cdp.send("Page.navigate", { url: URL_ARG });
    await sleep(4000);
    await cdp.send("Page.bringToFront");

    await cdp.evalJs(HELPERS);
    const snapshot = await cdp.evalJs('JSON.stringify({ groups: localStorage.getItem("dsh.sessionGroups.v1"), view: localStorage.getItem("dsh.workspace.view.v5") })');
    await cdp.evalJs("window.__e2eSnapshot = " + snapshot);

    // S1
    const r1 = JSON.parse(await cdp.evalJs('JSON.stringify({ rows: window.__e2e.rowKeys().length, sessions: window.__e2e.sessionRows().length, viewOptions: !!document.querySelector(\'button[aria-label="View options"]\') })'));
    assert("S1 页面就绪：会话行 + View options", r1.sessions > 0 && r1.viewOptions, JSON.stringify(r1));

    // S2 switch mode
    await cdp.evalJs('window.__e2e.click(document.querySelector(\'button[aria-label="View options"]\'))');
    await sleep(500);
    const items = JSON.parse(await cdp.evalJs("JSON.stringify(window.__e2e.menuItems())"));
    assert("S2a View options 菜单含自定义分组项", items.some((t) => /custom|自定义/i.test(t)), JSON.stringify(items));
    await cdp.evalJs('window.__e2e.click(window.__e2e.menuItemByText(/custom|自定义/i))');
    await sleep(1000);
    const mode = await cdp.evalJs("window.__e2e.view() && window.__e2e.view().groupBy");
    assert("S2b groupBy=custom 落盘", mode === "custom", String(mode));

    // S3 create group
    await cdp.evalJs('window.__e2e.click(document.querySelector(\'[data-row-key="custom:new-group"]\'))');
    await sleep(900);
    const groupsJson = await cdp.evalJs("JSON.stringify(window.__e2e.ls())");
    const ls1 = JSON.parse(groupsJson);
    const gid = ls1 && ls1.groups && ls1.groups[0] && ls1.groups[0].id;
    assert("S3a 新建分组：groups 落盘", !!gid && ls1.groups.length === 1, groupsJson);
    const headerVisible = gid ? await cdp.evalJs("!!window.__e2e.header(" + JSON.stringify(gid) + ")") : false;
    assert("S3b 分组头渲染", headerVisible === true, String(headerVisible));

    // S4 rename
    await cdp.evalJs("window.__e2e.click(window.__e2e.headerActions(" + JSON.stringify(gid) + "))");
    await sleep(500);
    await cdp.evalJs("window.__e2e.click(window.__e2e.menuItemByText(/rename|重命名/i))");
    await sleep(400);
    const hasInput = await cdp.evalJs("!!window.__e2e.renameInput()");
    assert("S4a 改名输入框出现", hasInput === true, String(hasInput));
    await cdp.evalJs("window.__e2e.setInput('E2E Group')");
    await cdp.evalJs("window.__e2e.press(window.__e2e.renameInput(), 'Enter')");
    await sleep(700);
    const rn = JSON.parse(await cdp.evalJs('JSON.stringify({ name: (window.__e2e.ls().groups.find((g) => g.id === ' + JSON.stringify(gid) + ') || {}).name, title: window.__e2e.headerTitle(' + JSON.stringify(gid) + ") })"));
    assert("S4b 改名落盘且标题同步", rn.name === "E2E Group" && rn.title === "E2E Group", JSON.stringify(rn));

    // S5 assign via row menu
    const sid = await cdp.evalJs("window.__e2e.pickSession()");
    assert("S5a 找到可操作会话行", !!sid, String(sid));
    await cdp.evalJs("window.__e2e.openRowMenu(" + JSON.stringify(sid) + ")");
    await sleep(500);
    const rowMenu = JSON.parse(await cdp.evalJs("JSON.stringify(window.__e2e.menuItems())"));
    assert("S5b 行菜单含移动到分组…", rowMenu.some((t) => /move to group|移动到分组/i.test(t)), JSON.stringify(rowMenu));
    await cdp.evalJs("window.__e2e.click(window.__e2e.menuItemByText(/move to group|移动到分组/i))");
    await sleep(600);
    const opts = JSON.parse(await cdp.evalJs("JSON.stringify(window.__e2e.moveOptions())"));
    assert("S5c Modal 列出分组选项", opts.some((o) => o.v === gid), JSON.stringify(opts));
    await cdp.evalJs("window.__e2e.chooseMove(" + JSON.stringify(gid) + ")");
    await sleep(800);
    const assigned = JSON.parse(await cdp.evalJs('JSON.stringify({ a: (window.__e2e.ls() || {}).assignments || {}, section: window.__e2e.sectionOf(' + JSON.stringify("session:" + sid) + ") })"));
    assert("S5d assignment 落盘且行移入分组", assigned.a[sid] === gid && assigned.section === "E2E Group", JSON.stringify(assigned));

    // S6 remove from group
    await cdp.evalJs("window.__e2e.openRowMenu(" + JSON.stringify(sid) + ")");
    await sleep(500);
    const rowMenu2 = JSON.parse(await cdp.evalJs("JSON.stringify(window.__e2e.menuItems())"));
    assert("S6a 已归组时出现移出项", rowMenu2.some((t) => /remove from custom group|移出自定义分组/i.test(t)), JSON.stringify(rowMenu2));
    await cdp.evalJs("window.__e2e.click(window.__e2e.menuItemByText(/remove from custom group|移出自定义分组/i))");
    await sleep(700);
    const removed = JSON.parse(await cdp.evalJs("JSON.stringify((window.__e2e.ls() || {}).assignments || {})"));
    assert("S6b 移出后 assignment 清空", !(sid in removed), JSON.stringify(removed));

    // S7 keyboard collapse on header
    await cdp.evalJs("window.__e2e.header(" + JSON.stringify(gid) + ").focus(); 1");
    await cdp.send("Page.bringToFront");
    await sleep(150);
    await cdp.key("Enter", "Enter", "\r");
    await sleep(600);
    const collapsed = JSON.parse(await cdp.evalJs('JSON.stringify({ exp: window.__e2e.header(' + JSON.stringify(gid) + ").getAttribute('aria-expanded'), stored: (window.__e2e.ls() || {}).collapsed })"));
    assert("S7a Enter 折叠分组头且落盘", collapsed.exp === "false" && collapsed.stored && collapsed.stored[gid] === true, JSON.stringify(collapsed));
    await cdp.key("Enter", "Enter", "\r");
    await sleep(600);
    const expanded = await cdp.evalJs("window.__e2e.header(" + JSON.stringify(gid) + ").getAttribute('aria-expanded')");
    assert("S7b Enter 再次展开", expanded === "true", String(expanded));

    if (SHOT_DIR) {
      mkdirSync(SHOT_DIR, { recursive: true });
      await cdp.shot(join(SHOT_DIR, "e2e-group.png"));
    }

    // S8 reload persistence
    await cdp.send("Page.reload");
    await cdp.send("Page.bringToFront");
    await sleep(5000);
    await cdp.evalJs(HELPERS);
    const persisted = JSON.parse(await cdp.evalJs('JSON.stringify({ mode: (window.__e2e.view() || {}).groupBy, name: ((window.__e2e.ls() || {}).groups || []).map((g) => g.name), title: window.__e2e.headerTitle(' + JSON.stringify(gid) + ") })"));
    assert("S8 reload 后模式/分组保留", persisted.mode === "custom" && persisted.title === "E2E Group", JSON.stringify(persisted));

    const errs = cdp.logs.filter((l) => l.type === "error" || l.type === "exception");
    assert("S9 无 console error / page exception", errs.length === 0, JSON.stringify(errs.slice(0, 4)));

    await cdp.evalJs('(() => { const s = window.__e2eSnapshot || {}; if (s.groups === null) localStorage.removeItem("dsh.sessionGroups.v1"); else localStorage.setItem("dsh.sessionGroups.v1", s.groups); if (s.view === null) localStorage.removeItem("dsh.workspace.view.v5"); else localStorage.setItem("dsh.workspace.view.v5", s.view); return 1; })()');
  } finally {
    try { await cdp.send("Page.close"); } catch {}
    try { cdp.ws.close(); } catch {}
    if (chromeProc) chromeProc.kill("SIGKILL");
    if (profileDir) rmSync(profileDir, { recursive: true, force: true });
  }

  const failed = results.filter((r) => !r.ok);
  console.log("\n" + (results.length - failed.length) + "/" + results.length + " passed" + (failed.length ? ", " + failed.length + " failed" : ""));
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error("e2e 失败:", (err && err.stack) || err);
  if (chromeProc) chromeProc.kill("SIGKILL");
  if (profileDir) rmSync(profileDir, { recursive: true, force: true });
  process.exit(1);
});
