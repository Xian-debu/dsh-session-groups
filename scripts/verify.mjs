#!/usr/bin/env node
/**
 * verify.mjs — 机械校验 fork 管线（任一失败 → 退出码 1）
 *
 *   V1 pristine 存在且 github 上游新鲜度一致（版本 + sha256，防上游升级后悄悄漂移）
 *   V2 lib/client.js 与「pristine + 改名 + patches」重新构建结果逐字节一致（防止手改产物）
 *   V3 产物不变量：模块 id = 本包名且恰好 1 次、无上游 id、含 window.__ModuleLoader__.load 与 factory
 *   V4 package.json 的 dsh.client.inject 与上游一致（上游升级后要人工确认新增 inject）
 *
 * 用法：node scripts/verify.mjs
 */
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTo, PACKAGE_ID, UPSTREAM_ID } from "./build.mjs";
import { readUpstream, sha256 } from "./vendor.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
function check(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log((ok ? "  ok   " : "  FAIL ") + id + (detail ? "  " + detail : ""));
}

const metaPath = join(ROOT, "vendor", "upstream.json");
const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : null;
check("V1a vendor/upstream.json 存在", !!meta);

/** 本机是否装有 DSH 上游包（离线 / CI 上通常没有）。 */
function tryUpstream() {
  try {
    return readUpstream();
  } catch {
    return null;
  }
}

if (meta) {
  // V1d 离线即可校验：vendored 快照与登记 sha256 一致（CI 也跑这一条）。
  const pristinePath = join(ROOT, "vendor", "client.pristine.js");
  const pristineOk = existsSync(pristinePath) && sha256(readFileSync(pristinePath)) === meta.sha256;
  check("V1d 快照 sha256 = upstream.json", pristineOk, meta.version + " sha256=" + (meta.sha256 || "?").slice(0, 12) + "…");
  const up = tryUpstream();
  if (up) {
    check("V1b 上游版本一致", meta.version === up.pkg.version, meta.version + " vs " + up.pkg.version);
    check("V1c 上游 sha256 一致", meta.sha256 === sha256(up.body), "若上游已升级：npm run vendor && npm run build 后重验");
  } else {
    console.log("  skip  V1b/V1c 未找到本机 DSH 安装（离线模式；保持 V1d 快照自校验）");
  }
}

const committed = join(ROOT, "lib", "client.js");
check("V2a lib/client.js 存在", existsSync(committed));
if (existsSync(committed)) {
  const tmp = mkdtempSync(join(tmpdir(), "dsh-session-groups-verify-"));
  try {
    const out = join(tmp, "client.js");
    const r = buildTo(out);
    const fresh = readFileSync(out);
    const have = readFileSync(committed);
    const same = sha256(fresh) === sha256(have);
    check("V2b 产物 = pristine+改名+patches", same, same ? "sha256=" + r.sha256 : "重新构建 sha256=" + r.sha256 + "，已提交=" + sha256(have) + "（跑 npm run build）");
    const text = have.toString("utf8");
    check("V3a 模块 id 恰好 1 次", text.split('id: "' + PACKAGE_ID + '"').length - 1 === 1);
    check("V3b 无上游模块 id", !text.includes('id: "' + UPSTREAM_ID + '"'));
    check("V3c 含 __ModuleLoader__.load", text.includes("__ModuleLoader__.load("));
    check("V3d 含 factory", text.includes("factory: (require)"));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
{
  const up = tryUpstream();
  const mine = ((pkg.dsh || {}).client || {}).inject || [];
  if (up) {
    const theirs = ((up.pkg.dsh || {}).client || {}).inject || [];
    check("V4 dsh.client.inject 与上游一致", JSON.stringify([...mine].sort()) === JSON.stringify([...theirs].sort()), mine.length + " vs " + theirs.length);
  } else {
    const registered = Array.isArray(meta && meta.inject) ? meta.inject : [];
    const same = JSON.stringify([...mine].sort()) === JSON.stringify([...registered].sort());
    check("V4 dsh.client.inject 与 vendor/upstream.json 记录一致", same, mine.length + " vs " + registered.length + "（离线模式）");
  }
}

const failed = results.filter((r) => !r.ok);
console.log(failed.length === 0 ? "[verify] PASS (" + results.length + " checks)" : "[verify] FAIL " + failed.length + "/" + results.length);
process.exit(failed.length === 0 ? 0 : 1);