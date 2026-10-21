#!/usr/bin/env node
/**
 * vendor.mjs — 把上游 @deepseek-ai/dsh-client-ui-workspace 的已构建客户端
 * 原样拷成 vendor/client.pristine.js，并记录来源（版本 / 字节数 / sha256 / inject）。
 *
 * 用法：node scripts/vendor.mjs
 * 覆盖核心目录：DSH_CORE_DIR=/path/to/node_modules/@deepseek-ai node scripts/vendor.mjs
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const UPSTREAM = "@deepseek-ai/dsh-client-ui-workspace";
export const PACKAGE = "dsh-session-groups";
/** 核心目录已是 @deepseek-ai/ 作用域目录内部，回溯要用裸包名。 */
export const UPSTREAM_NAME = UPSTREAM.split("/")[1];

function tryExec(cmd, args) {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

/** 候选核心目录：DSH_CORE_DIR → dsh 二进制所在 prefix → npm root -g → 本机已知路径。 */
export function coreModuleCandidates() {
  const out = [];
  if (process.env.DSH_CORE_DIR) out.push(resolve(process.env.DSH_CORE_DIR));
  const dshBin = tryExec("bash", ["-lc", "command -v dsh"]) || tryExec("which", ["dsh"]);
  if (dshBin) {
    try {
      out.push(join(dirname(dirname(realpathSync(dshBin))), "lib", "node_modules", "@deepseek-ai", "dsh", "node_modules", "@deepseek-ai"));
    } catch {
      /* 忽略 */
    }
  }
  const npmRoot = tryExec("npm", ["root", "-g"]);
  if (npmRoot) out.push(join(npmRoot, "@deepseek-ai", "dsh", "node_modules", "@deepseek-ai"));
  out.push("/root/.nvm/versions/node/v22.21.1/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai");
  return [...new Set(out)];
}

/** DSH 核心 scoped 包目录（…/node_modules/@deepseek-ai）。 */
export function coreModulesDir() {
  for (const dir of coreModuleCandidates()) {
    if (existsSync(join(dir, UPSTREAM_NAME, "lib", "client.js"))) return dir;
  }
  throw new Error("找不到含 " + UPSTREAM + " 的 DSH 核心模块目录；候选: " + coreModuleCandidates().join(", ") + "（可用 DSH_CORE_DIR 覆盖）");
}

export function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/** 读上游包信息 + client.js 内容（用于 vendor / verify 共用）。 */
export function readUpstream() {
  const pkgDir = join(coreModulesDir(), UPSTREAM_NAME);
  const clientPath = join(pkgDir, "lib", "client.js");
  const body = readFileSync(clientPath);
  const pkg = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  return { pkgDir, clientPath, body, pkg };
}

function main() {
  const { clientPath, body, pkg } = readUpstream();
  const metaPath = join(ROOT, "vendor", "upstream.json");
  const meta = {
    package: UPSTREAM,
    version: pkg.version,
    source: clientPath,
    bytes: body.length,
    sha256: sha256(body),
    inject: (pkg.dsh && pkg.dsh.client && pkg.dsh.client.inject) || [],
    vendoredAt: new Date().toISOString(),
    history: [],
  };
  if (existsSync(metaPath)) {
    try {
      const prev = JSON.parse(readFileSync(metaPath, "utf8"));
      meta.history = Array.isArray(prev.history) ? prev.history : [];
      if (prev.sha256 !== meta.sha256 || prev.version !== meta.version) {
        meta.history.push({ version: prev.version, sha256: prev.sha256, bytes: prev.bytes, vendoredAt: prev.vendoredAt });
      }
    } catch {
      /* 旧文件损坏则忽略历史 */
    }
  }
  mkdirSync(join(ROOT, "vendor"), { recursive: true });
  copyFileSync(clientPath, join(ROOT, "vendor", "client.pristine.js"));
  writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n");
  console.log("[vendor] " + UPSTREAM + "@" + meta.version + " → vendor/client.pristine.js");
  console.log("[vendor] bytes=" + meta.bytes + " sha256=" + meta.sha256);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
