# 07 · 路线图与提交点

| 阶段 | 目标 | 关键产物 | 验收 | 提交 |
| --- | --- | --- | --- | --- |
| **P0** ✅ | 探测构建逻辑、扩展点、可行性 | docs/01-05、10 | 文档可自洽解释「为什么只能 fork」 | `01-scaffold` |
| **P1** | vendor 管线 + fork 骨架跑起来（**零功能变化**） | `scripts/vendor.mjs` / `build.mjs` / `verify.mjs`、`vendor/upstream.json`、`lib/client.js`（仅改 id）、`lib/index.js`、`package.json`、`cordis.patch.yml` | 探针实例 3099 上：四选项行为与原生**完全一致**、现有 session 行 hole 插件（复制 ID 等）仍显示、可一键切回原生 | `02-fork-skeleton` |
| **P2** | 数据模型 + 第四种模式 + 只读渲染 | `src/custom-groups/store.js`、`src/custom-groups/list.js`、`patches/0001`（模式分支 + 菜单项 + 渲染） | 手动造数（localStorage 注入）后：分组正确渲染、唯一性成立、刷新保留、切换不崩 | `03-custom-mode` |
| **P3** | 拖入 / 拖出 / 分组管理 | 自定义拖拽提交、分组头菜单、新建/重命名/删除/调序 | 验收标准 6.2 的交互全通 | `04-drag-and-menus` |
| **P4** | 与既有机制协同打磨 | 搜索/归档/排序/置顶/水印/locale/键盘 | 无 console error；视觉与原生分组头一致 | `05-polish` |
| **P5** | e2e + 发布 + 回滚手册 | CDP e2e 脚本、发布步骤、快照回滚演练 | 一次完整安装→使用→回滚演练通过 | `06-release` |

## 每阶段固定动作

1. 开工前 `git status` 确认干净；改动前打 profile 快照。
2. 改完 `node scripts/verify.mjs` + 探针实例 3099 冒烟（不碰生产 3080）。
3. 阶段验收通过再 `cp -f lib/*.js` 到生产 profile（或重新 `dsh plugin`），刷新页面确认。
4. 提交 + 在 README 状态表打勾。

## P1 的具体待办

- `vendor/upstream.json`：记录 `{package, version, file, sha256, capturedAt}`。
- `scripts/vendor.mjs`：从 `…/dsh/node_modules/@deepseek-ai/dsh-client-ui-workspace/lib/client.js` 拷贝 pristine → `vendor/client.pristine.js`，写 `upstream.json`。
- `scripts/build.mjs`：pristine + `patches/*.patch` → `lib/client.js`（`git apply --check` 先行），生成 `lib/index.js`（空 apply）。
- `scripts/verify.mjs`：pristine sha 与安装目录一致、patch 可干净应用、产物里 `__ModuleLoader__.load({id:"dsh-session-groups"…` 正确、`dsh.client.inject` 与上游一致。
- `package.json`：`name: dsh-session-groups`、`exports["./client"]`、`dsh.client.platform=web`、`dsh.bundle.patch`。
- `cordis.patch.yml`：禁 `ui-workspace` + 插入本行。
