# 07 · 路线图与提交点

| 阶段 | 目标 | 关键产物 | 验收 | 提交 |
| --- | --- | --- | --- | --- |
| **P0** ✅ | 探测构建逻辑、扩展点、可行性 | docs/01-05、10 | 文档可自洽解释「为什么只能 fork」 | `01-scaffold` |
| **P1** ✅ | vendor 管线 + fork 骨架跑起来（**零功能变化**） | `scripts/vendor.mjs` / `build.mjs` / `verify.mjs`、`vendor/upstream.json`、`lib/client.js`（仅改 id）、`lib/index.js`、`package.json`、`cordis.patch.yml` | 已上线 3080 实测（见下方「P1 验收记录」）：原生渲染一致、三选项菜单仍在、0 console error、`ui-workspace` 已下线 | `03-p1-fork-skeleton` / `04-p1-install-verify` |
| **P2** ✅ | 数据模型 + 第四种模式 + 只读渲染 | `patches/0001-custom-groups.patch`（locale + 菜单项 + 渲染分支 + store/derive/列表组件，全部落在 `lib/client.js`）、`lib/client.js` 243,751 B | 探针 3099 CDP 验收（见下方「P2 验收记录」）：菜单出现第四项、切模式后 Ungrouped 平铺、点 New group 生成 Group 1 分区、localStorage 落盘、刷新保留、0 console error | `07-p2-custom-groups` |
| **P3a** ✅ | 分组头管理（新建入口、改名、调序、删除二次确认） | `patches/0002-p3a-group-header.patch`、`CustomGroupHeader`、store `moveGroup`、locale zh/en 各 9 键、`lib/client.js` 252,074 B | 探针 3099 CDP 验收（见下方「P3a 验收记录」）：改名、Move up、删除确认、未分组折叠全通，0 console error | `08-p3a-group-header` |
| **P3b** ✅ | 拖入 / 拖出 | `patches/0003-p3b-drag.patch`、会话行 `drag` 接线、分组头 drop 热区（`DROP_HINT_STYLE` / `DROP_HOVER_STYLE`）、`assign`/`unassign` 提交、`lib/client.js` 254,388 B | 探针 3099 CDP 验收（见下方「P3b 验收记录」）：拖入分组、拖回未分组、刷新保留、drop 高亮全通，0 console error | `09-p3b-drag` |
| **P4a** ✅ | 置顶会话独立区 | `patches/0004-p4a-pinned.patch`、`PINNED_SECTION_KEY`、`deriveCustomSections` 的 `pinned` 返回、`CustomGroupHeader` 的 `kind` 三态、`lib/client.js` 255,774 B | 探针 3099 CDP 验收（见下方「P4a 验收记录」）：置顶区在顶部独立成节、pin 会话不进分组且只出现一次、可折叠、取消置顶回落原分组、归档筛选不崩，0 console error | `10-p4a-pinned` |
| **P4b** ✅ | 会话行「⋯」菜单归组 | `patches/0005-p4b-menu-move.patch`、`MoveSessionToGroupMenuItem` / `RemoveSessionFromGroupMenuItem` / `MoveSessionDialog`、模块级 request store、locale zh/en 各 4 键、`lib/client.js` 261,838 B | 探针 3099 CDP 验收（见下方「P4b 验收记录」）：菜单项按归组状态条件出现、Modal 三选项、assign 落盘、行唯一移动、取消归组、刷新保留，0 console error | `11-p4b-menu-move` |
| **P4c** ✅ | 分组头 / 菜单键盘可达 + aria / locale 补全 | `patches/0006-p4c-keyboard.patch`（179 行）、`FOCUS_RING_STYLE`、头节点 `tabIndex=0` + `aria-label`/`aria-expanded`、Enter/空格折叠、F2 改名、Shift+F10/ContextMenu 开菜单、菜单内方向键/Home/End/Esc/Tab 导航、菜单锚 `aria-haspopup`/`aria-expanded`、装饰图标 `aria-hidden`、删除确认 Esc + Delete 自动聚焦、Modal 选项 `aria-current` + `autoFocus`、`lib/client.js` 265,401 B | 探针 3099 CDP 验收（见下方「P4c 验收记录」）：32 项全绿、0 console error（焦点环、折叠落盘、F2 改名/Esc、键盘开菜单并聚焦首项、方向键移动、Enter 激活、确认条 Esc/自动聚焦） | `12-p4c-keyboard` |
| **P4d** ✅ | 每组水印分页 + 折叠头拖拽自动展开 + 组内排序取舍 | `patches/0007-p4d-watermark.patch`（106 行）、`GROUP_WATERMARK_BASE = 5`、`DROP_EXPAND_DELAY_MS = 600`、每组 `groupWatermarks` state + `watermarkRows()` 分页、`sessionOverflowButton`（复用 `sessions.expand` / `sessions.collapse`）、dragOver 定时展开 + dragLeave/drop 清理、`lib/client.js` 267,425 B | 探针 3099 CDP 验收（见下方「P4d 验收记录」）：13 项全绿、0 console error（分页/展开/收起、aria-expanded、无分页组、折叠头自动展开且不改 assignment） | `13-p4d-watermark` |
| **P5** | e2e + 发布 + 回滚手册 | CDP e2e 脚本、发布步骤、快照回滚演练 | 一次完整安装→使用→回滚演练通过 | `06-release` |

## 每阶段固定动作

1. 开工前 `git status` 确认干净；改动前打 profile 快照。
2. 改完 `node scripts/verify.mjs` + 探针实例 3099 冒烟（不碰生产 3080）。
3. 阶段验收通过再 `cp -f lib/*.js` 到生产 profile（或重新 `dsh plugin`），刷新页面确认。
4. 提交 + 在 README 状态表打勾。

## P1 验收记录（2026-10-21）

- 快照：`/root/.dsh/.profile-snapshots/web/20261021-193308-pre-session-groups`（package.json / pnpm-lock.yaml / cordis.patch.yml + SHA256SUMS + parent git HEAD `666634c`）。
- 装法：`link:/root/dsh-session-groups` + bundles 追加 + 软链（pnpm 因 `dsh-preset-workbench@^0.1.3` 失配无法解析，属预先存在问题）。
- loader：`dsh --profile web --dump-config` 中 `# == @deepseek-ai/dsh-web-app, patched by dsh-session-groups` 段内 `ui-workspace: disabled: true`，另有独立 `- id: session-groups / name: dsh-session-groups` 行。
- 运行实例**热加载**（PID 未变）：`/plugins/??dsh-session-groups/client.js&rev=1fce792d2630` → 200（232,690 B，含 `__ModuleLoader__.load({ id: "dsh-session-groups"`）；`/plugins/??@deepseek-ai/dsh-client-ui-workspace/client.js&rev=37df9f73fcf9` → 404（已下线）。
- CDP 无头冒烟（`google-chrome --headless=new` + Node 原生 WebSocket，token URL 直连 3080）：页面正常渲染，侧栏会话列表与「Show 83 more sessions」在；点击 View options 弹出 Group by / Order by / Filter sessions 三组菜单（三个分组选项齐全）；**0 console error / 0 page exception**。
- 产物：`lib/client.js` 232,650 B（仅 id 改名，−18 B）。

## P2 验收记录（2026-10-21）

- 与计划的偏差：原计划把新代码放 `src/custom-groups/store.js` / `list.js`，实际**全部做成 `patches/0001` 的插入块**（在 `lib/client.js` 内、随上游同风格）。理由：客户端产物是单文件 classic script + factory，vendor/build/verify 管线（V2b 逐字节重建）已保证可复现，多一层源码拼接只会引入第二套构建路径；P3 起继续沿用补丁。
- 补丁锚点（每处替换都断言「恰好 1 处」，否则 build 失败）：zh/en locale 各插 3 个 key、`ViewOptionsMenu` items 加 `{id:"custom"}` 并把 onSelect 放行 `custom`、渲染分派插 `groupBy === "custom" ? jsx(CustomGroupsList, …)`、代码块插在 `/** The flat "In one list" body…` 之前。
- 管线：`node scripts/build.mjs` → 243,751 B / sha256 `050a5de8d0a5345d1bf8409c2e8f472021a4cccff487b9d91f3550c63e598a9c`；`node scripts/verify.mjs` → **PASS (10 checks)**。
- 探针实例（`DSH_PROFILE=web dsh web --port 3099 --no-open`）：chunk `/plugins/??dsh-session-groups/client.js&rev=398cd4badd48` → 200 / 243,791 B，含 `CustomGroupsList` ×2、`groupBy.custom` ×3。
- CDP（1440×900，界面语言 **en**）：View options → Group by 出现 **Custom groups**；点选后侧栏 = `Ungrouped` 单节 + 全部会话平铺 + 尾部 `New group`；点 New group ⇒ `Group 1`（在上）+ `Ungrouped`（在下），`data-row-key` = `["workspace:g1","workspace:__ungrouped__"]`，localStorage `dsh.sessionGroups.v1` = `{"version":1,"groups":[{"id":"g1","name":"Group 1",…}],"assignments":{},"groupOrder":["g1"],"ungroupedOrder":[],"collapsed":{},"updatedAt":…}`；EVENTS 空（0 error / 0 exception）。
- 已知欠账（P3/P4 处理）：分组头目前复用 `ProjectRowItem`（复用其「未分组」文案与折叠箭头）；`New group` 按钮在长列表末尾，P3a 已在分组头/菜单补入口（对应 docs/06 Q9）；拖入/拖出已在 P3b 接上（跨容器 assign/unassign + 分组头 drop 热区）。

## P3a 验收记录（2026-10-21）

- 交付：`patches/0002-p3a-group-header.patch`（321 patches/0002-p3a-group-header.patch 行），新增 `CustomGroupHeader`（折叠 / 双击或菜单改名 / 菜单：rename·move-up·move-down·delete / 行内二次确认条），store 增加 `moveGroup(id, delta)`，locale zh/en 各补 9 键（`custom.renameGroup` / `deleteGroup` / `moveUp` / `moveDown` / `deleteConfirm` / `confirmDelete` / `cancel` / `groupActions` / `untitled`），侧栏头部 `groupBy === "custom"` 时插入 `New group` 图标按钮，未分组节折叠状态改由 `groupsState.collapsed[""]` 驱动。
- 管线：`node scripts/build.mjs` → `lib/client.js` 252,074 B / sha256 `739ea8163924362e7e890b4b1950a55c407410d53d30157d3dfb7075ef887cd5`，patches = 0001,0002；`node scripts/verify.mjs` → **PASS (10 checks)**。
- 探针（3099 + CDP 1440×900，界面语言 en）：清 localStorage 后 reload → View options 切 **Custom groups** → 头部 `New group` 建 `g1`、底部按钮建 `g2` → 菜单 rename 为 `Renamed`（localStorage `groups[0].name = "Renamed"`）→ g2 **Move up**（`groupOrder` = `["g2","g1"]`，`data-row-key` 顺序同步）→ g2 **Delete group** 出现行内确认条 `Delete group “Group 2”? Delete / Cancel`，点 Delete 后 `groups` 只剩 `g1` → 点未分组头折叠，`collapsed[""] = true`、会话行 91 → 0。**0 console error / 0 page exception**（reload 后清空日志缓冲再断言）。
- 期间修掉两个真实缺陷：① locale 漏加 9 个 key ⇒ 空名分组把原始 key `custom.untitled` 显示出来；② store 漏加 `moveGroup` ⇒ 点 Move up 抛 `TypeError: sessionGroupsHandle.actions.moveGroup is not a function` 并连带 React #311。
- 探针坑：同一个 token URL 二次 `Page.navigate` 不再渲染（token 一次性）⇒ 改为「清 localStorage + `Page.reload`」（httpOnly cookie 保活）；`Runtime.enable` 会重放上一页缓存的 console 消息 ⇒ 必须在 reload 完成后清空 logs 再断言。

## P3b 验收记录（2026-10-21）

- 交付：`patches/0003-p3b-drag.patch`（120 行）。`CustomGroupsList` 新增 `dragSession` 状态 + `useNativeDragAcceptance`，每条 `SessionNodeItem` 接上 `drag`（start/end 只维护 `dragSession`，组内不排序），`CustomGroupHeader` 接 `dragAccept` / `onDropSession` 做后置 drop 目标：拖拽中所有分组头显示 `DROP_HINT_STYLE`（虚线环），悬停头显示 `DROP_HOVER_STYLE`（虚线环 + hover 底色），落点执行 `assign(sessionId, groupId)`（分组头）或 `unassign(sessionId)`（未分组头），同组/未分组重复投放为 no-op。
- 管线：`node scripts/build.mjs` → `lib/client.js` 254,388 B / sha256 `0c14b706ed20187ad580d64a166ca4494196d8cf403b5474abb76a4c69ac4258`，patches = 0001,0002,0003；`node scripts/verify.mjs` → **PASS (10 checks)**。
- 探针（3099 + CDP 1440×900，界面语言 en，拖拽用页面内 `new DragEvent(..., { dataTransfer: new DataTransfer() })` 合成）：先清 localStorage + reload → 切 **Custom groups** → 建 `g1`；挑一条 `draggable === true` 的未分组会话行（`blank` 的 New Session 行按设计不可拖，探针里用 `draggable === true` 过滤，候选 90 条）→ `dragstart` 后 dataTransfer 里是 `session-…` id，两个分组头都出现虚线提示环 → `dragover` `workspace:g1` 后该头变强调色环 + hover 底色 → `drop` 后 `assignments[session-…] = "g1"`，行归属从 `workspace:__ungrouped__` 迁到 `workspace:g1`，reload 后仍是 `workspace:g1` → 再从 `g1` 拖到 `workspace:__ungrouped__`，`assignments` 清空、行回到未分组。**0 console error / 0 page exception**。
- 已知限制（P4d 已处理前两项）：~~拖拽经过折叠的分组头时不会自动展开~~（P4d：600ms 后自动展开）；组内拖拽排序未接（组内顺序仍按列表原始顺序，P4d 决策见 docs/06 §6.5）；拖拽期间没有 `dragend` 兜底清理以外的取消动画。

## P4a 验收记录（2026-10-21）

- 交付：`patches/0004-p4a-pinned.patch`（202 行）。要点：locale zh/en 各加 `custom.pinned`（置顶 / Pinned）；新增 `const PINNED_SECTION_KEY = "__pinned__";`；`deriveCustomSections` 把「可见且置顶且非 blank」的会话收进独立的 `pinnedRows`（不再进任何分组桶），返回值多一个 `pinned`；`CustomGroupHeader` 增加 `kind` ∈ `"group"|"ungrouped"|"pinned"`，菜单/双击改名只在真实分组上出现，折叠键对置顶节用 `__pinned__`，置顶头 `dropEnabled = dragAccept && !pinnedHeader`（不接投放）；`CustomGroupsList` 的 sections 顺序改为「置顶节（有置顶才出现）→ 各真实分组 → 未分组」，置顶行 `drag: void 0`（不可拖，归组留给 P4b 右键菜单）。
- 管线：`node scripts/build.mjs` → `lib/client.js` 255,774 B / sha256 `98500cc762136e3064429e84c00af4e86e562940249fa3bf05d75712a1d689e4`，patches = 0001,0002,0003,0004；`node scripts/verify.mjs` → **PASS (10 checks)**。
- 探针（3099 + CDP 1440×900，界面语言 en）：切 **Custom groups** → 点行内 `Pin session` ⇒ `data-row-key` 首行变 `workspace:__pinned__`（文本 `Pinned`），置顶会话落在其下、未分组节仍在；点 `Pinned` 头 ⇒ `expanded="false"`、该会话行消失、`collapsed["__pinned__"] = true` 落盘；再点展开后 `Unpin session` ⇒ 行回到未分组；随后用 localStorage 预置 `assignments[session-…] = "g1"` 再 pin + reload ⇒ 该会话**只出现一次**（在置顶节），`Group 1` 只剩空头 —— 证明置顶优先级高于归组、显示唯一；`Archived only` 筛选下自定义模式正常渲染分组头（置顶区因无归档置顶会话而隐藏），切回 `Hide archived` 恢复。**0 console error / 0 page exception**（reload 后清空日志缓冲再断言）。
- 探针坑（新增）：① root 下 headless chrome 必须 `--no-sandbox`，否则直接退出；② 复用旧 chrome 实例会 `timeout Page.navigate` / `timeout Runtime.evaluate`，**每个脚本前重启 chrome**（pkill 模式 `cdp-prof-p4`）最稳；③ 会话行的 `Pin session` 按钮在 hover 才渲染，且 hover 后原 row 引用可能失效 ⇒ 直接在页面全局取第一个 `button[aria-label="Pin session"]` 点击，再用 `closest("[data-row-key]")` 回读归属。

## P4b 验收记录（2026-10-21）

- 交付：`patches/0005-p4b-menu-move.patch`（194 行）。要点：模块级 request store（`createMoveSessionRequestStore()`），菜单项只负责 `open(sessionId)`；`MoveSessionToGroupMenuItem` 在没有分组时 `return null`，`RemoveSessionFromGroupMenuItem` 在 `assignments[sessionId] === void 0` 时 `return null`（两项都先 `setMenuOpen(false)` 再动作，避免菜单项点击被 portal 关闭吃掉）；`MoveSessionDialog` 挂在 `shell.overlay`，用宿主 `Modal` 列出「各真实分组 + 未分组（移出）」，选项为 `button[data-move-option]`（真实分组值 = groupId，移出项值 = `__none__`），当前归属打勾；选择后 `assign` / `unassign` 并关闭。菜单项 order = 350 / 360（排在 `session-id` 450 之前）。
- locale：zh `移动到分组…` / `移出自定义分组` / `移动到分组` / `未分组（移出）`；en `Move to group…` / `Remove from custom group` / `Move to group` / `No group (remove)`。
- 管线：`node scripts/build.mjs` → `lib/client.js` 261,838 B / sha256 `b35a75e4b415756cb8427301d31f87a4416720719ac724c80ce4c9891fd9ff3d`，patches = 0001..0005；`node scripts/verify.mjs` → **PASS (10 checks)**；重建产物与手改文件逐字节一致。
- 探针（3099 + CDP 1440×900，界面语言 en）：localStorage 预置两个分组（Group 1 / Group 2）→ 真实 UI 走 `View options → Custom groups` 切到自定义模式（`dsh.workspace.view.v5.groupBy = "custom"`）→ 选一条**非置顶、有 ⋯ 按钮**的会话行 → 点 `⋯`：菜单按序为 `Pin session / Rename / Fork session / Move to group… / Archive session / Copy Session ID / Export session as Markdown`，**未归组时没有** `Remove from custom group`；点 `Move to group…` ⇒ Modal 三选项 `Group 1 / Group 2 / No group (remove)`（当前归属打勾）；点 `Group 1` ⇒ `assignments[session-…] = "g1"` 落盘、Modal 关闭、该行**只出现一次**且位于 `Group 1` 节下；再点 `⋯` ⇒ 出现 `Remove from custom group`，点掉 ⇒ `assignments` 清空、行离开分组节；再归组到 `Group 2` 后 `Page.reload` ⇒ 模式仍为 custom、assignment 仍在、行仍在 `Group 2` 节下。**0 console error / 0 page exception**。截图：`/tmp/p4b-dialog.png`（Modal）、`/tmp/p4b-menu.png`（归组后侧栏）。
- 探针坑（新增）：① `scripts/build.mjs` 会 **pristine + patches 重写 `lib/client.js`**，所以 patch 必须在 build **之前**生成（顺序：手改 → `diff -u` 出 patch → build → verify 逐字节比对），否则手改内容被抹平、patch 变 0 行（本次已踩过一次）；② 宿主**没有真正的 `contextmenu`**，合成 `MouseEvent("contextmenu")` 不会开菜单，必须点行内 `button[aria-label^="Session actions for"]`；③ `New Session`（blank）行**不渲染** ⋯ 按钮，探针需跳过；④ 置顶会话的显示优先级高于归组，探针必须选非置顶行，否则归组后行仍留在 `Pinned` 节；⑤ 分组头标题是 `span[class*="_title"]`（不是 button），且 assignment 的键是**裸 session id**（无 `session:` 前缀），与 `data-row-key` 的 `session:` 前缀要做转换；⑥ 先 `localStorage` 预置再 reload 会被页面卸载时的状态回写覆盖，稳妥做法是预置后只 reload 一次，模式切换走真实 UI。

## P4c 验收记录（2026-10-21）

- 交付物：`patches/0006-p4c-keyboard.patch`（179 行，基线 `git show 4b0900f:lib/client.js`）；`node scripts/build.mjs` → `lib/client.js` **265,401 B / sha256 `71f417707d9b7afd36f9b5ee30b76e2129e278877d90833ce7a2b64b3e7e30f5`**，patches 0001..0006；pristine+patches 重建与手改逐字节一致；`node scripts/verify.mjs` → PASS (10 checks)。
- 键盘模型：分组头 `div[data-row-key]` 加 `tabIndex=0` + `aria-label`（已有 `aria-expanded`）；Enter/空格 = 折叠切换，F2（仅真实分组）= 行内改名，Shift+F10 / ContextMenu = 打开 `⋯` 菜单；焦点时显示 `FOCUS_RING_STYLE`（2px accent 描边、outline-offset -2px），且**焦点环优先于拖拽提示**（`dropOver > focused > dropEnabled`）。
- 菜单键盘：打开时若由键盘触发（F10/ContextMenu，或锚按钮 click 的 `detail===0`），`requestAnimationFrame` 聚焦第一个菜单项；document capture keydown 处理 ArrowDown/ArrowUp（循环）、Home/End、Escape（关闭并把焦点还给锚按钮）、Tab（关闭后交还浏览器）。
- a11y/locale：菜单锚补 `aria-haspopup="menu"` / `aria-expanded`；folder 与 chevron 图标 `aria-hidden`；删除确认条 `tabIndex=0` + `aria-label`，Escape 取消，确认 Delete 按钮 `autoFocus`；Modal 选项 `aria-current`（选中）+ `autoFocus`。locale 无新增键（复用 `custom.groupActions` 等既有键）。
- 探针：`/tmp/p4c.mjs` + `/tmp/p4c-helper.js`，`bash /tmp/restart-chrome.sh` 后跑 3099（token URL），**32/32 PASS、0 console error / 0 exception**；截图 `/tmp/p4c-header-focus.png`（焦点环）、`/tmp/p4c-final.png`（删除 g1 后只剩 Group 2）。
- 探针踩坑（新增，重要）：
  1. **headless 页面必须 `Page.bringToFront`**：否则 `document.hasFocus()===false`，`element.focus()` 只设置 `activeElement` 而不派发 focus/focusin，React `onFocus` 不触发 ⇒ 焦点环断言假失败（`style` 始终为 null）。
  2. CDP 触发 Enter 激活按钮要用 `Input.dispatchKeyEvent` 的 **`type: "keyDown"` + `text: "\r"`**（`rawKeyDown` 不触发 button 默认动作）。
  3. 菜单打开后焦点**不会**自动进入菜单（activeElement 仍是头节点），必须自己 rAF 聚焦首项；菜单项是 `button[role=menuitem][tabindex=0]`。
  4. 删除确认条只出现在「菜单已关闭」状态：若上一步 Enter 未激活导致菜单仍开着，再点锚按钮会把它关掉 ⇒ 断言前先确保菜单关闭（按 Esc 收尾）。

## P4d 验收记录（2026-10-21）

- 交付物：`patches/0007-p4d-watermark.patch`（106 行，基线 `git show 7186c36:lib/client.js`）；`node scripts/build.mjs` → `lib/client.js` **267,425 B / sha256 `39dd618c3c43e74588a039a35f567010dfd8af084f1d015681d47c4519b866e0`**，patches 0001..0007；pristine+patches 重建与手改逐字节一致；`node scripts/verify.mjs` → PASS (10 checks)。
- 水印分页：模块常量 `GROUP_WATERMARK_BASE = 5`（与宿主 `SESSION_WATERMARK_BASE` 一致）；`CustomGroupsList` 内 `groupWatermarks: {[sectionKey]: number}` state，每组 `watermark = groupWatermarks[key] ?? 5`，用宿主 `watermarkRows(sessions, watermark)` 取可见行（blank 行始终可见）；仅当 `sessions.length > 5` 时渲染 `button.sessionOverflowButton[data-row-key="overflow:<groupKey>"]`，文案复用宿主 locale `sessions.expand({n: hiddenCount})`（en `Show N more sessions` / zh `显示其余 N 个会话`）与 `sessions.collapse`（en `Show less` / zh `收起`）；点击时若当前为 `Infinity` 则删 key 收起，否则 `hiddenCount <= 5 ? Infinity : current + 5`；`aria-expanded` 跟随。水印仅存在组件 state（与宿主一致，刷新重置）。
- 折叠头拖拽自动展开：`CustomGroupHeader` 内 `dropExpandTimer` ref；`onDragOver` 时若 `!section.expanded` 且无待触发定时器，则 `setTimeout(toggleGroup(...), DROP_EXPAND_DELAY_MS = 600)`；`onDragLeave`（真正离开）与 `onDrop` 清理定时器，卸载时 `useEffect` 清理。**只展开、不改 assignment**（拖放提交仍由 drop 处理）。
- 组内排序取舍（决策）：**沿用宿主组内顺序（按「最近更新 / 手动排序」开关），不提供自定义组内排序**。理由：组内 order 与 pin 唯一性、搜索跨组、归档筛选语义互相冲突，且跨组拖拽已覆盖「归组」诉求；`groupOrder` 仅管分组顺序。已写入 `docs/06-design-draft.md` §6.5。
- 探针（3099 + CDP 1440×900，界面语言 en）：`/tmp/p4dprobe3.mjs`（页面 helper 复用 `/tmp/p4c-helper.js`）。前置：先在默认模式反复点宿主 `Show N more sessions` 17 次展开 87 条会话 → 取 7 条非置顶会话 assign `g1`、2 条 assign `g2` → `Page.reload` → 真实 UI 切 `Custom groups`。断言：Group 1 可见 5 行 + pager 文案 `Show 2 more sessions`/`aria-expanded=false`、Group 2 全部 2 行且无 pager；点 pager ⇒ 7 行 + `Show less`/`aria-expanded=true`；再点 ⇒ 回 5 行；折叠 Group 2（Enter）后从 Group 1 拖行 `dragover` 折叠头 ⇒ 300ms 时仍折叠、900ms 后展开，且 `assignments` 仍为 g1=7 / g2=2；`dragend` 收尾。**13/13 PASS、0 console error / 0 exception**。截图：`/tmp/p4d-watermark.png`（7 行展开态）、`/tmp/p4d-autoexpand.png`（折叠头被拖拽展开）。
- 探针踩坑（新增）：
  1. CDC `Runtime.evaluate` 的 `returnByValue` 已把对象反序列化，**不要**再 `JSON.parse` 对象结果（`SyntaxError: "[object Object]" is not valid JSON"`）；返回 JSON 字符串的表达式才需要 parse。
  2. Node 字符串里写页面代码时，`'...\"...'` 会把反斜杠吞掉导致页面语法错误；统一用模板字符串 + 单引号属性选择器（`querySelector('button[data-row-key="overflow:g1"]')`）再 `JSON.stringify` 传参。
  3. 新 profile 只有 6 条会话在 DOM 里，但宿主实际有 87 条：分页断言必须先点宿主自己的 `Show N more sessions` 把列表展开，才能拿到足够多的 session id 做 seeding。
  4. 宿主与插件的 pager 都是 `button.sessionOverflowButton[data-row-key^="overflow:"]`，断言必须精确到 `overflow:g1` / `overflow:g2`。

## 后续阶段的固定待办

- `lib/index.js` 由仓库手工维护（host 空 apply），不在构建产物里生成。
- 每阶段按「改 → `node scripts/verify.mjs` → 刷新页面/CDP 冒烟 → 提交」走；因是软链安装，**不需要** `cp -f lib/*.js` 到 profile。
