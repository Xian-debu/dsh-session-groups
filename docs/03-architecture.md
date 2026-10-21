# 03 · 架构：DSH 会话侧栏是怎么构建的

## 3.1 加载链路

```
profile package.json  dsh.profile.bundles 列表
        │  （dsh plugin add 自动追加 bundle）
        ▼
bundle 自带 cordis.patch.yml（dsh.bundle.patch）→ merge 进 loader 行
        ▼
dsh --profile web --dump-config   →  行：- id: ui-workspace  name: '@deepseek-ai/dsh-client-ui-workspace'
        ▼
dsh-client-modules：按 dsh.client 声明把 `<pkg>/client` 作为经典脚本下发
        ▼
浏览器 window.__ModuleLoader__.load({id, factory}) 注册模块 → cordis 客户端插件树
        ▼
workspace 插件 apply(ctx)：建 view store、provideRoot、注册 slot `sidebar.workspaces`
```

- loader 行 id 与包名解耦：行的 `id` 只是调用点标识，`name` 才是包名（可被 patch 层 `- id:` 定向覆盖/禁用/插入）。
- 本次 fork 目标行：**`- id: ui-workspace`**，由 bundle `@deepseek-ai/dsh-web-app` 挂载（`dump-config` 第 1224-1225 行附近）。

## 3.2 关键文件

| 文件 | 大小 | 说明 |
| --- | --- | --- |
| `…/dsh-client-ui-workspace/lib/client.js` | 232,668 B / 5,354 行 | 会话浏览器全部 UI：分组、排序、拖拽、右键菜单、视图弹层 |
| `…/dsh-client-ui-workspace/lib/index.js` | 11 行 | host 半：空 `apply()`，纯 UI 插件 |
| `…/dsh-client-ui-sidebar/lib/client.js` | — | 侧栏骨架，定义 hole `sidebar.workspaces`（single）并 `renderSlot` |
| `…/dsh-client-modules/lib/{index,client}.js` | — | 客户端模块下发与 `__ModuleLoader__` |

## 3.3 数据流

```
ctx.sessions.list（快照：byId / 排序 / 归档 / retainedBy.mainView）
ctx.workspaces（快照：workspaceId / sessionIds / cwd / createdAt / 父子关系）
        │
        ├─ viewStore（localStorage "dsh.workspace.view.v5"）
        │     groupBy: "workspace" | "workspace-tree" | "flat"
        │     orderBy: "manual" | "updated"
        │     groupExpansion / sessionOrderByAccount / archivedFilter
        │
        ├─ deriveGroups() 1091-1113
        │     ├─ groupByWorkspace() 1027-1046  → 每 workspace 一组；落单 → key=""
        │     └─ buildGroup() 1002-1011 / sessionNode() 1059-1074
        │
        └─ 渲染 3965-4018：query 非空 → SearchResults
                             groupBy==="flat" → FlatList 3978
                             否则 → SessionTree 3994（nestWorkspaces = groupBy==="workspace-tree" 4004）
```

## 3.4 行号锚点表（0.2.1-rc.2，实施与升级对照用）

| 锚点 | 行号 | 内容 |
| --- | --- | --- |
| locale zh | 4749-4828 | `groupBy.label`=`分组方式` 4764、`groupBy.workspace` 4765、`groupBy.workspaceTree` 4766、`groupBy.flat` 4767、`menu.sessionId` 4807、`toast.sessionIdCopied` 4808 |
| view store | 1265-1315 | `createWorkspaceViewStore`：init 默认 `groupBy:"workspace"`、`persist:"dsh.workspace.view.v5"`、8 个 action |
| 分组计算 | 1002-1113 | `buildGroup`/`groupByWorkspace`/`sessionNode`/`deriveGroups` |
| 未分组排序键 | 1256 | `FLAT_SESSION_ORDER_KEY="__flat_session_order__"` |
| 视图弹层 | 2877-2960 | `ViewOptionsMenu`：三组硬编码项 + 排序/筛选 + 底部 IconSlidersTwo 图标（2981） |
| 模式读取 | 3527 | `const groupBy = useStore((s)=>s.groupBy)` |
| 渲染分派 | 3965-4018 | SearchResults / FlatList / SessionTree 三路；`animationResetKey`=`${groupBy}/${orderBy}/${archivedFilter}` |
| 拖拽排序 | 2987-2999 | `sessionDragOrder(order, rows, drag, over)`：仅同 pinned 段内插入 |
| 拖拽提交 | 3107-3119 | `commitSessionDrag`：`accountSessionIds` 只取源账号组 → 无跨组搬移 |
| 行拖拽属性 | 1967-1977, 2261-2292, 2275 | `data-row-key="workspace:<key>"` / `"session:<id>"`；`draggable = drag!==void 0 && !row.blank && !row.archived` |
| 行 DOM 钩子 | 2275 | 行根元素带 `data-row-key="session:<sessionId>"`（DOM 兜底方案的定位依据） |
| slot 注册 | 5220-5251 | `sidebar.workspaces` + 5 个子 hole |
| viewStore 注入 | 5024, 5039-5043 | 建 store、`provideRoot`、`locale.register("workspace")` |

## 3.5 持久化

| 键 | 位置 | 现有内容 | 本插件 |
| --- | --- | --- | --- |
| `dsh.workspace.view.v5` | localStorage | groupBy / orderBy / groupExpansion / sessionOrderByAccount / archivedFilter | **不改**；自定义分组另起 `dsh.sessionGroups.v1` |

## 3.6 fork 后的运行形态

- 包名 `dsh-session-groups`，自己声明 `dsh.client.inject`（复制上游 12 项依赖声明）、`exports["./client"]`、host 空 `apply()`。
- 自己的 patch 层：`- id: ui-workspace  disabled: true` + `- insert: [{id: session-groups, name: dsh-session-groups}]`。
- `lib/client.js` = 上游 pristine 副本 + `patches/0001-custom-groups.patch`，`id` 从 `@deepseek-ai/dsh-client-ui-workspace` 改为 `dsh-session-groups`。
- 因为 module id 与包名一致，`require("dsh-session-groups/client")` 与运行时映射自洽；内部只 require 5 个外部模块（cordis / store / primitives / react / jsx-runtime），跨包隔离良好。
