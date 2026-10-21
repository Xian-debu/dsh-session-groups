# 07 · 路线图与提交点

| 阶段 | 目标 | 关键产物 | 验收 | 提交 |
| --- | --- | --- | --- | --- |
| **P0** ✅ | 探测构建逻辑、扩展点、可行性 | docs/01-05、10 | 文档可自洽解释「为什么只能 fork」 | `01-scaffold` |
| **P1** ✅ | vendor 管线 + fork 骨架跑起来（**零功能变化**） | `scripts/vendor.mjs` / `build.mjs` / `verify.mjs`、`vendor/upstream.json`、`lib/client.js`（仅改 id）、`lib/index.js`、`package.json`、`cordis.patch.yml` | 已上线 3080 实测（见下方「P1 验收记录」）：原生渲染一致、三选项菜单仍在、0 console error、`ui-workspace` 已下线 | `03-p1-fork-skeleton` / `04-p1-install-verify` |
| **P2** ✅ | 数据模型 + 第四种模式 + 只读渲染 | `patches/0001-custom-groups.patch`（locale + 菜单项 + 渲染分支 + store/derive/列表组件，全部落在 `lib/client.js`）、`lib/client.js` 243,751 B | 探针 3099 CDP 验收（见下方「P2 验收记录」）：菜单出现第四项、切模式后 Ungrouped 平铺、点 New group 生成 Group 1 分区、localStorage 落盘、刷新保留、0 console error | `07-p2-custom-groups` |
| **P3a** ✅ | 分组头管理（新建入口、改名、调序、删除二次确认） | `patches/0002-p3a-group-header.patch`、`CustomGroupHeader`、store `moveGroup`、locale zh/en 各 9 键、`lib/client.js` 252,074 B | 探针 3099 CDP 验收（见下方「P3a 验收记录」）：改名、Move up、删除确认、未分组折叠全通，0 console error | `08-p3a-group-header` |
| **P3b** ✅ | 拖入 / 拖出 | `patches/0003-p3b-drag.patch`、会话行 `drag` 接线、分组头 drop 热区（`DROP_HINT_STYLE` / `DROP_HOVER_STYLE`）、`assign`/`unassign` 提交、`lib/client.js` 254,388 B | 探针 3099 CDP 验收（见下方「P3b 验收记录」）：拖入分组、拖回未分组、刷新保留、drop 高亮全通，0 console error | `09-p3b-drag` |
| **P4a** ✅ | 置顶会话独立区 | `patches/0004-p4a-pinned.patch`、`PINNED_SECTION_KEY`、`deriveCustomSections` 的 `pinned` 返回、`CustomGroupHeader` 的 `kind` 三态、`lib/client.js` 255,774 B | 探针 3099 CDP 验收（见下方「P4a 验收记录」）：置顶区在顶部独立成节、pin 会话不进分组且只出现一次、可折叠、取消置顶回落原分组、归档筛选不崩，0 console error | `10-p4a-pinned` |
| **P4b–d** | 协同打磨剩余项 | 右键「移动到分组 / 移出自定义分组」、键盘可达 + locale/aria、每组水印分页 + 折叠头拖拽自动展开 + 组内排序取舍 | 无 console error；视觉与原生分组头一致 | `11-p4b-…` 起 |
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
- 已知限制（交 P4 决定是否补）：拖拽经过折叠的分组头时不会自动展开；组内拖拽排序未接（组内顺序仍按列表原始顺序）；拖拽期间没有 `dragend` 兜底清理以外的取消动画。

## P4a 验收记录（2026-10-21）

- 交付：`patches/0004-p4a-pinned.patch`（202 行）。要点：locale zh/en 各加 `custom.pinned`（置顶 / Pinned）；新增 `const PINNED_SECTION_KEY = "__pinned__";`；`deriveCustomSections` 把「可见且置顶且非 blank」的会话收进独立的 `pinnedRows`（不再进任何分组桶），返回值多一个 `pinned`；`CustomGroupHeader` 增加 `kind` ∈ `"group"|"ungrouped"|"pinned"`，菜单/双击改名只在真实分组上出现，折叠键对置顶节用 `__pinned__`，置顶头 `dropEnabled = dragAccept && !pinnedHeader`（不接投放）；`CustomGroupsList` 的 sections 顺序改为「置顶节（有置顶才出现）→ 各真实分组 → 未分组」，置顶行 `drag: void 0`（不可拖，归组留给 P4b 右键菜单）。
- 管线：`node scripts/build.mjs` → `lib/client.js` 255,774 B / sha256 `98500cc762136e3064429e84c00af4e86e562940249fa3bf05d75712a1d689e4`，patches = 0001,0002,0003,0004；`node scripts/verify.mjs` → **PASS (10 checks)**。
- 探针（3099 + CDP 1440×900，界面语言 en）：切 **Custom groups** → 点行内 `Pin session` ⇒ `data-row-key` 首行变 `workspace:__pinned__`（文本 `Pinned`），置顶会话落在其下、未分组节仍在；点 `Pinned` 头 ⇒ `expanded="false"`、该会话行消失、`collapsed["__pinned__"] = true` 落盘；再点展开后 `Unpin session` ⇒ 行回到未分组；随后用 localStorage 预置 `assignments[session-…] = "g1"` 再 pin + reload ⇒ 该会话**只出现一次**（在置顶节），`Group 1` 只剩空头 —— 证明置顶优先级高于归组、显示唯一；`Archived only` 筛选下自定义模式正常渲染分组头（置顶区因无归档置顶会话而隐藏），切回 `Hide archived` 恢复。**0 console error / 0 page exception**（reload 后清空日志缓冲再断言）。
- 探针坑（新增）：① root 下 headless chrome 必须 `--no-sandbox`，否则直接退出；② 复用旧 chrome 实例会 `timeout Page.navigate` / `timeout Runtime.evaluate`，**每个脚本前重启 chrome**（pkill 模式 `cdp-prof-p4`）最稳；③ 会话行的 `Pin session` 按钮在 hover 才渲染，且 hover 后原 row 引用可能失效 ⇒ 直接在页面全局取第一个 `button[aria-label="Pin session"]` 点击，再用 `closest("[data-row-key]")` 回读归属。

## 后续阶段的固定待办

- `lib/index.js` 由仓库手工维护（host 空 apply），不在构建产物里生成。
- 每阶段按「改 → `node scripts/verify.mjs` → 刷新页面/CDP 冒烟 → 提交」走；因是软链安装，**不需要** `cp -f lib/*.js` 到 profile。
