#!/usr/bin/env node
/**
 * build.mjs — pristine → lib/client.js
 *
 * 步骤（顺序固定、全部可断言）：
 *   1) 模块 id 改名：唯一一处 id: "@deepseek-ai/dsh-client-ui-workspace" → "dsh-session-groups"
 *      （ModuleLoader 以包名索引模块，id 必须等于本包名；断言恰好 1 处）
 *   2) 依次应用 patches/*.patch（按文件名字典序；git apply，工作目录为临时目录下的 lib/client.js）
 *
 * 用法：node scripts/build.mjs [outFile]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const UPSTREAM_ID = "@deepseek-ai/dsh-client-ui-workspace";
export const PACKAGE_ID = "dsh-session-groups";
const PRISTINE = join(ROOT, "vendor", "client.pristine.js");
const PATCH_DIR = join(ROOT, "patches");

export function listPatches() {
  if (!existsSync(PATCH_DIR)) return [];
  return readdirSync(PATCH_DIR).filter((f) => f.endsWith(".patch")).sort();
}

function applyPatches(text, patches) {
  if (patches.length === 0) return text;
  const tmp = mkdtempSync(join(tmpdir(), "dsh-session-groups-"));
  try {
    mkdirSync(join(tmp, "lib"), { recursive: true });
    writeFileSync(join(tmp, "lib", "client.js"), text);
    for (const name of patches) {
      execFileSync("git", ["apply", "--unsafe-paths", "--whitespace=nowarn", join(PATCH_DIR, name)], {
        cwd: tmp,
        stdio: ["ignore", "pipe", "pipe"],
      });
    }
    return readFileSync(join(tmp, "lib", "client.js"), "utf8");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** 构建到 outFile，返回 { bytes, sha256, patches }。 */
export function buildTo(outFile) {
  if (!existsSync(PRISTINE)) throw new Error("缺少 vendor/client.pristine.js —— 先跑 npm run vendor");
  const pristine = readFileSync(PRISTINE, "utf8");
  const needle = 'id: "' + UPSTREAM_ID + '",';
  const hits = pristine.split(needle).length - 1;
  if (hits !== 1) throw new Error("pristine 中模块 id 断言失败：期望恰好 1 处 " + needle + "，实际 " + hits + " 处");
  let text = pristine.replace(needle, 'id: "' + PACKAGE_ID + '",');
  if (text.includes('id: "' + UPSTREAM_ID + '",')) throw new Error("改名后仍残留上游模块 id");
  const patches = listPatches();
  text = applyPatches(text, patches);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, text);
  const buf = Buffer.from(text);
  return { bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex"), patches };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] ? resolve(process.argv[2]) : join(ROOT, "lib", "client.js");
  const r = buildTo(out);
  console.log("[build] " + out);
  console.log("[build] bytes=" + r.bytes + " sha256=" + r.sha256 + " patches=" + (r.patches.length ? r.patches.join(",") : "(none)"));
}
