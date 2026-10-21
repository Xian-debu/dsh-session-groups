# 07 · 路线图与提交点

| 阶段 | 目标 | 关键产物 | 验收 | 提交 |
| --- | --- | --- | --- | --- |
| **P0** ✅ | 探测构建逻辑、扩展点、可行性 | docs/01-05、10 | 文档可自洽解释「为什么只能 fork」 | `01-scaffold` |
| **P1** ✅ | vendor 管线 + fork 骨架跑起来（**零功能变化**） | `scripts/vendor.mjs` / `build.mjs` / `verify.mjs`、`vendor/upstream.json`、`lib/client.js`（仅改 id）、`lib/index.js`、`package.json`、`cordis.patch.yml` | 已上线 3080 实测（见下方「P1 验收记录」）：原生渲染一致、三选项菜单仍在、0 console error、`ui-workspace` 已下线 | `03-p1-fork-skeleton` / `04-p1-install-verify` |
| **P2** ✅ | 数据模型 + 第四种模式 + 只读渲染 | `patches/0001-custom-groups.patch`（locale + 菜单项 + 渲染分支 + store/derive/列表组件，全部落在 `lib/client.js`）、`lib/client.js` 243,751 B | 探针 3099 CDP 验收（见下方「P2 验收记录」）：菜单出现第四项、切模式后 Ungrouped 平铺、点 New group 生成 Group 1 分区、localStorage 落盘、刷新保留、0 console error | `07-p2-custom-groups` |
| **P3** | 拖入 / 拖出 / 分组管理 | 自定义拖拽提交、分组头菜单、新建/重命名/删除/调序 | 验收标准 6.2 的交互全通 | `04-drag-and-menus` |
| **P4** | 与既有机制协同打磨 | 搜索/归档/排序/置顶/水印/locale/键盘 | 无 console error；视觉与原生分组头一致 | `05-polish` |
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
- 已知欠账（P3/P4 处理）：分组头目前复用 `ProjectRowItem`（复用其「未分组」文案与折叠箭头），尚无拖入热区、改名、删除、调序；`New group` 按钮在长列表末尾，需要 P3 在分组头/菜单里补入口（对应 docs/06 Q9）；拖拽（拖入/拖出）整体未接。

## 后续阶段的固定待办

- `lib/index.js` 由仓库手工维护（host 空 apply），不在构建产物里生成。
- 每阶段按「改 → `node scripts/verify.mjs` → 刷新页面/CDP 冒烟 → 提交」走；因是软链安装，**不需要** `cp -f lib/*.js` 到 profile。
