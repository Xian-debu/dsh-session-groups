# 12 · 发布与回滚手册

本手册面向「已经在这台机器上装好 dsh-session-groups、接下来要升级或回滚」的人（通常是未来的自己）。
所有命令都可复制执行；凡是需要**断言**的地方都给了期望输出。

## 12.0 事实基线（2026-10-21 核对）

| 项 | 值 |
| --- | --- |
| 仓库 | `/root/dsh-session-groups`（独立 git） |
| 安装形态 | profile 里 `link:` + 软链（**源码目录即生效目录**，改完刷新页面即可） |
| profile | `/root/.dsh/profiles/web` |
| 软链 | `/root/.dsh/profiles/web/node_modules/dsh-session-groups -> /root/dsh-session-groups` |
| 服务 | `systemctl restart dsh-web`（unit `dsh-web`，ExecStart=`/root/.dsh/dsh-web-lan.sh`），监听 3080 |
| 插件 id | `session-groups`（包名 `dsh-session-groups`） |
| 产物 | `lib/client.js`（267,425 B）+ `lib/index.js`（纯空 `apply()`） |
| 构造 | `vendor/client.pristine.js` + `patches/0001..0007`，由 `scripts/build.mjs` 文本级应用 |
| 安装前快照 | `/root/.dsh/.profile-snapshots/web/20261021-193308-pre-session-groups/`（package.json / pnpm-lock.yaml / cordis.patch.yml / SHA256SUMS.txt / parent-git-head.txt=666634c） |
| localStorage | `dsh.sessionGroups.v1`（本插件）、`dsh.workspace.view.v5`（宿主视图偏好，含 `groupBy`） |
| dsh 可执行 | `/root/.nvm/versions/node/v22.21.1/bin/dsh`（非登录 shell 里不在 PATH，脚本里请写绝对路径） |

## 12.1 发布前门禁（三件套，缺一不可）

```bash
cd /root/dsh-session-groups
node scripts/build.mjs      # pristine + patches → lib/client.js，打印 bytes / sha256 / patches 列表
node scripts/verify.mjs     # 期望：PASS (10 checks)
node scripts/e2e.mjs --url "http://127.0.0.1:3099/?token=<探针实例 token>"
```

- `build.mjs` **会用 pristine + patches 覆盖 `lib/client.js`**。手工改过 `lib/client.js` 时必须**先**出 patch 再 build，否则改动被抹掉（P4b 踩过一次：patch 变 0 行、文件回到 255,774 B）。
- `e2e.mjs` 对**非生产实例**跑（建议 3099 临时实例）。它会建一个临时分组 `E2E Group`、改一次名、移动并移出一条会话，结束前把 `dsh.sessionGroups.v1` / `dsh.workspace.view.v5` 还原成启动快照。
- e2e 参数：`--url <token URL>`（或 env `DSH_E2E_URL`）、`--chrome <bin>`（默认自动探测 /usr/bin/google-chrome 等）、`--screenshots <dir>`（额外落一张 `e2e-group.png`）。退出码 0/1/2（2 = 缺 `--url`）。
- e2e 会自己起一个 `--headless=new --no-sandbox --remote-debugging-port=0` 的临时 chrome，用后 kill 并删临时 profile；不占用 9223。

## 12.2 首次安装（新机器 / 重装）

```bash
# 1) 快照（回滚的唯一依据，先做）
SNAP=/root/.dsh/.profile-snapshots/web/$(date +%Y%m%d-%H%M%S)-pre-session-groups
mkdir -p "$SNAP"
cp -a /root/.dsh/profiles/web/{package.json,pnpm-lock.yaml,cordis.patch.yml} "$SNAP"/
cd "$SNAP" && sha256sum package.json pnpm-lock.yaml cordis.patch.yml > SHA256SUMS.txt
git -C /root/dsh-session-groups rev-parse --short HEAD > "$SNAP/parent-git-head.txt"

# 2) profile 登记（两处）
#    /root/.dsh/profiles/web/package.json
#      dependencies["dsh-session-groups"] = "link:/root/dsh-session-groups"
#      dsh.profile.bundles 末尾追加 "dsh-session-groups"

# 3) 软链
ln -sfn /root/dsh-session-groups /root/.dsh/profiles/web/node_modules/dsh-session-groups

# 4) 重启 + 断言
systemctl restart dsh-web
/root/.nvm/versions/node/v22.21.1/bin/dsh --profile web --dump-config > /tmp/dump.yml
grep -n 'patched by dsh-session-groups' /tmp/dump.yml   # 期望有 1 行
grep -n 'session-groups' /tmp/dump.yml                  # 期望「# == dsh-session-groups」+「- id: session-groups」
```

第 4 步的 `patched by dsh-session-groups` 段里应当是：

```yaml
# == @deepseek-ai/dsh-web-app, patched by dsh-session-groups
- id: ui-workspace
  name: '@deepseek-ai/dsh-client-ui-workspace'
  disabled: true
```

即「原生 workspace 包被下线、本包接管 `sidebar.workspaces` hole」。然后浏览器**硬刷新**（Ctrl+Shift+R），View options → Group by 里应出现第四项 **Custom groups**。

> 备选安装法：`dsh plugin --profile web add link:/root/dsh-session-groups`（会自动追加 bundles）。
> 若 pnpm 报 `ERR_PNPM_NO_MATCHING_VERSION`（历史原因：`dsh-preset-workbench@^0.1.3` 在镜像上不可解析；现 profile 已钉 `^1.0.2`），就退回上面手工三步。
> 若用 `file:` 而非 `link:`：pnpm 是**拷贝**，改完 `lib/` 必须 `cp -f lib/*.js /root/.dsh/profiles/web/node_modules/dsh-session-groups/lib/`；`link:` 无此问题。

## 12.3 日常升级（只改本仓）

1. 改 `lib/client.js` → 立刻出 patch（基线 = 上一阶段提交的 `lib/client.js`）：
   `diff -u --label a/lib/client.js --label b/lib/client.js /tmp/base.js lib/client.js > patches/000N-xxx.patch`
2. 跑 12.1 三件套。
3. 因为装的是软链，**无需拷贝**；浏览器硬刷新即可（client 半 500ms 轮询热更，通常刷新一次就够）。
4. 确认 `git status` 只含本次改动，按 `NN-stage: 一句话中文` 提交。

## 12.4 上游 DSH 升级后

```bash
node scripts/vendor.mjs   # 抓新 pristine，记录 version/sha256 到 vendor/upstream.json
node scripts/build.mjs    # 应用 patches；冲突会打印 hunk，人工改 patch 而不是改 lib/client.js
node scripts/verify.mjs
node scripts/e2e.mjs --url ...
```

- 冲突原则见 `docs/08-conventions.md` §8.2：只增不改上游逻辑，新增块集中放置。
- 上游改了既有行的，要在 `docs/03-architecture.md` 锚点表更新行号。

## 12.5 临时禁用（保留分组数据）

只从 **bundles** 列表里去掉名称，保留依赖与软链：

1. 编辑 `/root/.dsh/profiles/web/package.json`，删掉 `dsh.profile.bundles` 里的 `"dsh-session-groups"` 一行。
2. `systemctl restart dsh-web`
3. 断言：`--dump-config` 里**没有** `# == dsh-session-groups` 段，且 `ui-workspace` 不再 `disabled: true`（原生侧栏回归）。
4. 硬刷新 → View options 只剩原生三选项。

副作用：本包的 `cordis.patch.yml` 不再生效，所以 `ui-workspace` 会自动恢复；`localStorage` 分组数据**保持**，重新加回 bundles + 重启即原样恢复。

> 不要只删依赖不删 bundles，也不要只改 `cordis.patch.yml` —— 前者会让整个 profile 解析失败起不来。

## 12.6 卸载 / 回到安装前

按顺序执行：

```bash
# 1) 从 bundles 与 dependencies 移除
#    （用 dsh plugin remove 也行：dsh plugin --profile web remove dsh-session-groups）
# 2) 删软链
rm -f /root/.dsh/profiles/web/node_modules/dsh-session-groups
# 3) 重启
systemctl restart dsh-web
# 4) 断言：无 session-groups 段、ui-workspace 未 disabled
```

若需要**逐字节回到安装前**，用快照还原：

```bash
SNAP=/root/.dsh/.profile-snapshots/web/20261021-193308-pre-session-groups
cd "$SNAP" && sha256sum -c SHA256SUMS.txt          # 三个文件都应 OK
cp -a "$SNAP"/{package.json,pnpm-lock.yaml,cordis.patch.yml} /root/.dsh/profiles/web/
systemctl restart dsh-web
```

若 loader 已经起不来（白屏、`dsh web` 直接报错）：用 `dsh web --patch <file>` 临时跳过本包行，或直接还原上面三个文件后重启。

## 12.7 版本回滚（代码层）

- 看历史：`git -C /root/dsh-session-groups log --oneline`
- 方式 A（推荐，保留历史）：`git revert <sha>` → `build.mjs` → `verify.mjs` → `e2e.mjs` → 硬刷新。
- 方式 B（回到某阶段产物）：`git checkout <sha> -- patches lib && node scripts/build.mjs`，确认 build 打印的 sha256 与 `lib/client.js` 一致 → `verify.mjs` → `e2e.mjs`。
- **禁止**只手改 `lib/client.js` 来救火：下一次 `build.mjs` 会按 patches 重写它，改动静默消失。

当前产物指纹（2026-10-21，P4d）：

| 项 | 值 |
| --- | --- |
| `lib/client.js` | 267,425 B / sha256 `39dd618c3c43e74588a039a35f567010dfd8af084f1d015681d47c4519b866e0` |
| patches | 0001–0007 |
| 对应提交 | `6125fe4 13-p4d-watermark` |

## 12.8 数据清理

| 键 | 内容 | 说明 |
| --- | --- | --- |
| `dsh.sessionGroups.v1` | `{version,groups,assignments,groupOrder,ungroupedOrder,collapsed,updatedAt}` | 本插件全部数据；删掉即「分组清空、会话全回未分组」 |
| `dsh.workspace.view.v5` | 宿主侧栏视图偏好（含 `groupBy`） | 不要整键删，会连 order/filter 一起丢 |

正确姿势：

1. **先**在 UI 里把分组方式切回 `In one list`（或 `Workspace Tree`）。
2. DevTools console：`localStorage.removeItem("dsh.sessionGroups.v1")`。
3. 立刻 reload。

**为什么不能直接删键再刷新**：页面卸载/刷新时 React 状态会写回 localStorage，先删键再 reload 会被覆盖（P4b 探针踩过这条：预置数据后 reload 同样被覆盖，所以探针只 reload 一次、其余走真实 UI）。

只想复位单个分组 / 单条会话：在 DevTools 里改 JSON 后 reload 也要遵守上面「先切走 → 改 → 刷新」的顺序。

## 12.9 故障排查

| 症状 | 先查什么 | 处置 |
| --- | --- | --- |
| 侧栏整体白屏 / 会话列表消失 | `--dump-config` 里 `session-groups` 段与 `ui-workspace disabled: true` 是否同时存在 | 二者只应存在其一；都缺就按 12.6 回滚 |
| View options 里没有 **Custom groups** | bundles 是否含 `dsh-session-groups`；页面是否硬刷新过 | 加回 bundles → 重启 → 硬刷新 |
| 会话在侧栏出现两次 | 原生 `ui-workspace` 是否仍启用（patch 未生效） | 检查 `# == @deepseek-ai/dsh-web-app, patched by dsh-session-groups` 段 |
| 改完代码 3080 没变化 | `lib/client.js` 的 bytes/sha 是否已变；软链是否还在 | 硬刷新；`ls -l /root/.dsh/profiles/web/node_modules/dsh-session-groups` |
| 分组数据「保存不上」 | 是否走了「删键后直接刷新」的路径 | 按 12.8 顺序操作 |
| `e2e.mjs` 报 `fetch failed: unknown scheme` | 已修：`ws://` 的 `URL.origin` 不是 http，脚本显式换成 `http://<host:port>` | 升级到含该修复的版本即可 |
| e2e 卡在 `Page.navigate` 超时 | 残留 chrome 实例 / 旧 profile | `pkill -f cdp-prof`；e2e 自身用临时 profile，不受影响 |
| `edit` 报 `file changed since it was read` | 文件刚被 `build.mjs` 重写 | 先 `read` 再 `edit` |

## 12.10 演练记录（2026-10-21）

| 演练项 | 结果 |
| --- | --- |
| 发布门禁三件套 | ✅ `build.mjs` → 267,425 B / `39dd618c…`；`verify.mjs` → PASS (10 checks)；`e2e.mjs` → **17/17 passed**（0 console error / 0 exception） |
| 安装基线核对 | ✅ 软链指向 `/root/dsh-session-groups`；`--dump-config` 有 `# == @deepseek-ai/dsh-web-app, patched by dsh-session-groups` → `ui-workspace disabled: true`，另有 `# == dsh-session-groups` → `- id: session-groups` |
| 快照可恢复性 | ✅ `20261021-193308-pre-session-groups/` 三个文件 + `SHA256SUMS.txt` 齐全（`sha256sum -c` 未实际执行，文件与校验和已在位） |
| 数据清理路径 | ✅ 经 e2e 的「快照还原」逻辑间接验证（脚本结束会写回启动前的两个键） |
| 真实卸载 / 快照还原 / `systemctl restart` | ⏳ 未在生产 3080 实切：会中断当前正在使用的 Web 会话，且必须重启服务。命令已逐条核对路径与期望输出；建议在 3080 无人使用时执行一次「12.5 禁用 → 确认原生三选项 → 加回 → 确认 Custom groups」，这是唯一还没被自动化覆盖的环节 |

**已知残余风险**：禁用/卸载只对 3080 的实际页面生效，探针 3099 复用同一 profile，所以自动化无法替代这一次手工演练。
