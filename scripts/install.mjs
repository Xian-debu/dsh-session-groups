#!/usr/bin/env node
/**
 * install.mjs — 把本仓库以「源码目录即生效目录」的方式装进一个 DSH profile。
 *
 * 做的事（幂等，全部可回退）：
 *   1) profile/package.json：dependencies["dsh-session-groups"] = "link:<本仓库>"
 *   2) profile/package.json：dsh.profile.bundles 追加 "dsh-session-groups"
 *      （bundles 顺序 = 覆盖层顺序；本包自带 cordis.patch.yml 会禁用核心
 *        ui-workspace 并挂载本包，删掉这行即回滚原生三选项）
 *   3) node_modules/dsh-session-groups → 本仓库的软链
 *
 * 用法：
 *   node scripts/install.mjs                      # 装进默认 profile（web）
 *   node scripts/install.mjs --profile work       # 指定 profile
 *   node scripts/install.mjs --dry-run            # 只打印将发生的改动
 *   node scripts/install.mjs --check              # 只体检，不写盘
 *   node scripts/install.mjs --remove             # 卸载（删依赖 + 删 bundle 行 + 删软链）
 *
 * 选项：
 *   --profile <name>   $DSH_HOME/profiles/<name>，默认 web
 *   --home <dir>       DSH_HOME，默认 $DSH_HOME 或 ~/.dsh
 *   --json             以 JSON 输出结果（便于脚本化）
 *
 * 改完必须重启 dsh web 进程才生效（插件集合只在进程启动时装载）。
 */
import { existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, renameSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const NAME = PKG.name;

function parseArgs(argv) {
  const out = { profile: "web", home: process.env.DSH_HOME || join(homedir(), ".dsh"), dryRun: false, check: false, remove: false, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--profile") out.profile = argv[++i];
    else if (a === "--home") out.home = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--check") out.check = true;
    else if (a === "--remove") out.remove = true;
    else if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else throw new Error("未知参数: " + a);
  }
  return out;
}

const HELP = [
  "用法: node scripts/install.mjs [--profile web] [--home ~/.dsh] [--dry-run|--check|--remove] [--json]",
  "",
  "  --profile <name>  要安装到的 DSH profile（默认 web）",
  "  --home <dir>      DSH_HOME（默认 $DSH_HOME 或 ~/.dsh）",
  "  --dry-run         只打印将发生的改动，不写盘",
  "  --check           只体检当前安装状态",
  "  --remove          卸载（删除依赖登记、bundles 行、node_modules 软链）",
  "  --json            机器可读输出",
].join("\n");

const ARGS = parseArgs(process.argv.slice(2));
function log(msg) {
  if (!ARGS.json) console.log(msg);
}

function ensureBuild() {
  const lib = join(ROOT, "lib", "client.js");
  if (!existsSync(lib)) {
    throw new Error("缺少 lib/client.js —— 先跑 npm run build（需要本机装有 DSH 上游包才能 vendor）");
  }
  return lib;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function backup(file) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  let dst = file + ".bak." + stamp;
  let n = 1;
  while (existsSync(dst)) dst = file + ".bak." + stamp + "-" + n++;
  renameSync(file, dst);
  return dst;
}

function status(profileDir) {
  const pkgPath = join(profileDir, "package.json");
  const linkPath = join(profileDir, "node_modules", NAME);
  const pkg = existsSync(pkgPath) ? readJson(pkgPath) : null;
  const dep = pkg && pkg.dependencies ? pkg.dependencies[NAME] : undefined;
  const bundles = (pkg && pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles) || [];
  let link = null;
  if (existsSync(linkPath)) {
    const st = lstatSync(linkPath);
    if (st.isSymbolicLink()) {
      let target = "";
      try { target = readlinkSync(linkPath); } catch { target = ""; }
      link = { target: resolve(dirname(linkPath), target), symlink: true };
    } else {
      link = { target: linkPath, symlink: false };
    }
  }
  return { dep, inBundles: bundles.includes(NAME), bundles, link, pkgPath, linkPath };
}

function main() {
  const args = ARGS;
  if (args.help) {
    console.log(HELP);
    return;
  }
  const profileDir = join(resolve(args.home), "profiles", args.profile);
  const result = { profileDir, changed: false, actions: [] };

  if (!existsSync(join(profileDir, "package.json"))) {
    throw new Error("找不到 profile: " + profileDir + "（用 --profile/--home 指定；可用 dsh --from-default-profile " + args.profile + " 先创建）");
  }

  const st = status(profileDir);
  result.status = {
    installed: st.dep === "link:" + ROOT && st.inBundles && !!st.link,
    dependency: st.dep ?? null,
    inBundles: st.inBundles,
    bundleCount: st.bundles.length,
    symlink: st.link,
  };

  if (args.check) {
    const ok = st.dep === "link:" + ROOT && st.inBundles && st.link && st.link.symlink && st.link.target === ROOT;
    log((ok ? "[install] OK  " : "[install] WARN ") + profileDir);
    log("  dependency  : " + (st.dep ?? "(missing)"));
    log("  bundles     : " + (st.inBundles ? "contains " + NAME : "missing " + NAME) + " (" + st.bundles.length + " total)");
    log("  node_modules: " + (st.link ? (st.link.symlink ? "symlink → " + st.link.target : "real directory (不是软链)") : "(missing)"));
    if (!ok) log("  → 运行 node scripts/install.mjs --profile " + args.profile + " 修复");
    if (args.json) console.log(JSON.stringify(result, null, 2));
    process.exitCode = ok ? 0 : 1;
    return;
  }

  const pkgPath = join(profileDir, "package.json");
  const pkg = readJson(pkgPath);
  pkg.dependencies = pkg.dependencies || {};
  pkg.dsh = pkg.dsh || {};
  pkg.dsh.profile = pkg.dsh.profile || {};
  const bundles = Array.isArray(pkg.dsh.profile.bundles) ? pkg.dsh.profile.bundles : (pkg.dsh.profile.bundles = []);
  const wantDep = "link:" + ROOT;
  const linkPath = join(profileDir, "node_modules", NAME);

  if (args.remove) {
    if (pkg.dependencies[NAME] !== undefined) {
      delete pkg.dependencies[NAME];
      result.actions.push("remove dependency " + NAME);
    }
    const idx = bundles.indexOf(NAME);
    if (idx >= 0) {
      bundles.splice(idx, 1);
      result.actions.push("remove bundle entry " + NAME);
    }
    if (existsSync(linkPath) && lstatSync(linkPath).isSymbolicLink()) {
      result.actions.push("remove symlink node_modules/" + NAME);
    }
    if (!args.dryRun) {
      if (result.actions.length) {
        const bak = backup(pkgPath);
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
        log("[install] 备份 package.json → " + bak);
      }
      if (existsSync(linkPath) && lstatSync(linkPath).isSymbolicLink()) unlinkSync(linkPath);
    }
    result.changed = result.actions.length > 0;
    log((args.dryRun ? "[dry-run] " : "[install] ") + (result.changed ? "已卸载 " + NAME : NAME + " 未安装，无需卸载"));
    for (const a of result.actions) log("  - " + a);
    log("[install] 重启 dsh web 后恢复原生三选项：sudo systemctl restart dsh-web（或重新 dsh web）");
    if (args.json) console.log(JSON.stringify(result, null, 2));
    return;
  }

  ensureBuild();

  if (pkg.dependencies[NAME] !== wantDep) {
    pkg.dependencies[NAME] = wantDep;
    result.actions.push("set dependency " + NAME + " = " + wantDep);
  }
  if (!bundles.includes(NAME)) {
    bundles.push(NAME);
    result.actions.push("append bundle entry " + NAME);
  }
  let linkAction = "";
  if (existsSync(linkPath)) {
    const stl = lstatSync(linkPath);
    if (!stl.isSymbolicLink()) {
      throw new Error("已存在真实目录 " + linkPath + "（不是软链）。请先移走它，或用 --remove 后重装");
    }
    let cur = "";
    try { cur = resolve(dirname(linkPath), readlinkSync(linkPath)); } catch { cur = ""; }
    if (cur !== ROOT) linkAction = "retarget symlink → " + ROOT;
  } else {
    linkAction = "create symlink node_modules/" + NAME + " → " + ROOT;
  }
  if (linkAction) result.actions.push(linkAction);

  if (args.dryRun) {
    log("[dry-run] profile = " + profileDir);
    for (const a of result.actions) log("  - " + a);
    if (!result.actions.length) log("  (无改动，已是最新)");
    if (args.json) console.log(JSON.stringify(result, null, 2));
    return;
  }

  const needJsonWrite = result.actions.some((a) => !a.startsWith("retarget") && !a.startsWith("create symlink"));
  if (needJsonWrite) {
    const bak = backup(pkgPath);
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
    log("[install] 备份 package.json → " + bak);
  }
  if (!existsSync(linkPath)) {
    mkdirSync(dirname(linkPath), { recursive: true });
    const rel = relative(dirname(linkPath), ROOT) || ".";
    symlinkSync(process.platform === "win32" ? ROOT : rel, linkPath, process.platform === "win32" ? "junction" : "dir");
  } else if (linkAction.startsWith("retarget")) {
    unlinkSync(linkPath);
    symlinkSync(process.platform === "win32" ? ROOT : relative(dirname(linkPath), ROOT) || ".", linkPath, process.platform === "win32" ? "junction" : "dir");
  }
  result.changed = result.actions.length > 0;
  log((result.changed ? "[install] 安装/更新完成 " : "[install] 已是最新 ") + NAME);
  log("  profile     : " + profileDir);
  for (const a of result.actions) log("  - " + a);
  log("[install] 本包自带 cordis.patch.yml：会禁用核心 ui-workspace 并挂载本包（回滚 = --remove）");
  log("[install] 重启 dsh web 后生效：sudo systemctl restart dsh-web（或重新 dsh web）");
  if (args.json) console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (err) {
  console.error("[install] 失败：" + err.message);
  process.exitCode = 1;
}
