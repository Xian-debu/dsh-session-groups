# 08 · 工程规范

## 8.1 仓库

- 本仓库独立 git，根目录即插件包根（`package.json` + `docs/` + `src/` + `vendor/` + `patches/` + `lib/`）。
- 提交格式：`<两位编号>-<阶段名>: <一句话中文>`，一小步一提交。
- `lib/` 是产物，**跟随源码提交**（便于 `file:` 安装与回滚）；`vendor/client.pristine.js` 必须提交（可复现构建）。
- `/root/dsh-plugins` 是另一个仓库且当前有未提交改动，**本仓库提交不得包含它**。

## 8.2 vendor 升级流程（DSH 升级后）

```bash
node scripts/vendor.mjs      # 抓新 pristine + 记 sha256/version
node scripts/build.mjs       # 应用 patches；冲突会打印 hunk 供人工修
node scripts/verify.mjs      # 失败即不装
# 人工：探针 3099 冒烟 + 四选项与原生对比
```

- 补丁冲突原则：**只增不改上游逻辑**，新增代码尽量集中成块（利于重打）；必须改上游既有行的地方在 `docs/03-architecture.md` 锚点表登记行号。
- 上游版本变化记入 `vendor/upstream.json` 历史（追加 `history[]`）。

## 8.3 构建与产物约束

- 上游 client.js 已是构建产物（经典脚本 + `__ModuleLoader__`），**不要 esbuild 再打包**，只需文本级应用补丁。
- 产物 id 必须等于包名 `dsh-session-groups`；`dsh.client.inject` 与上游一致（12 项）。
- host 半 `lib/index.js` 只需 `export function apply() {}`（纯 UI 插件）。

## 8.4 安装 / 同步（踩过的坑）

- 安装：`dsh plugin --profile web add file:/root/dsh-session-groups`（会自动追加 `dsh.profile.bundles`）。
- **pnpm `file:` 是拷贝**：改了 `lib/` 必须 `cp -f lib/*.js /root/.dsh/profiles/web/node_modules/dsh-session-groups/lib/`，或 `rm -rf` 后 `pnpm install --offline`。
- **硬链接农场陷阱**：`edit` 工具 temp+rename 会断硬链 → 改文件后重新 `cp -f`，不要假设同步。
- client 半 500ms 轮询热更；host 半改动重启 `systemctl restart dsh-web`。
- 探针实例：`dsh web --port 3099 --patch /tmp/probe-patch.yml`，用完即杀。

## 8.5 验证

| 层 | 方法 |
| --- | --- |
| 静态 | `node scripts/verify.mjs`；`grep -c "dsh-session-groups"` 产物 |
| 路由/加载 | `curl -s localhost:3080/plugins/??dsh-session-groups/client.js` → 200 且内容含 `__ModuleLoader__` |
| 视觉/交互 | CDP e2e：Node 22 全局 WebSocket + chrome-headless-shell `--remote-debugging-port=9222`，`PUT /json/new`，boot 需带 `?token=` |
| 回归 | 现有 hole 插件仍在（复制 ID、hover 动作）；四选项切换不崩 |

## 8.6 回滚

1. 安装前快照：`cp -a /root/.dsh/profiles/web/{package.json,pnpm-lock.yaml,cordis.patch.yml} <snapshot>/` + `command -v dsh plugin` 记录版本。
2. 回滚命令：`dsh plugin --profile web remove dsh-session-groups` → 确认 `dump-config` 里 `ui-workspace` 行恢复且无 `session-groups` 行 → 刷新页面。
3. 万一 loader 起不来：走 `--patch` 临时禁用本包行，或直接还原 `package.json` + `pnpm install --offline`。

## 8.7 清理纪律

- 探针端口、临时 patch、e2e 产物不留在 `/root` 与 `/tmp` 之外；收尾 `git status` 干净。
- 不删用户既有备份（如 `cordis.patch.yml.bak*`），要删先问。
