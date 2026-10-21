# 02 · 约束清单

## 技术约束（由 P0 探测确认）

| # | 约束 | 证据 |
| --- | --- | --- |
| T1 | `sidebar.workspaces` 是 `kind: "single"` hole，全 App 只能有一个注册者 | `dsh-client-ui-sidebar/lib/client.js:507-510` |
| T2 | 「分组方式」三个选项硬编码在 `ViewOptionsMenu`，无 slot / 注册表 | `dsh-client-ui-workspace/lib/client.js:2877-2960` |
| T3 | 核心 client 包之间无模块 alias / override / 运行时替换能力 | `dsh-client-modules/lib/client.js:361`、`lib/index.js:415`（仅"私有描述符替换与未用模块清理"注释） |
| T4 | `commitSessionDrag` 仅支持组内重排，跨账号组搬移缺失 | `client.js:3107-3119`（`accountSessionIds` 取自 `activeDrag.accountKey`） |
| T5 | 分组视图状态走 `defineStore({persist:"dsh.workspace.view.v5"})`，键固定在 localStorage | `client.js:1265-1315` |
| T6 | client 半产物必须是经典脚本，通过 `window.__ModuleLoader__.load({id, factory})` 注册，`id` 用包名 | `dsh-client-modules/lib/index.js:18,463`；本机模板 `dsh-session-id-copy/lib/client.js` |
| T7 | 本包上游为 MIT，可 vendor；须保留版权与许可声明 | `dsh-client-ui-workspace/package.json` license=MIT |

## 环境约束

- DSH `0.2.1-rc.2`；核心包只存在于 dsh 安装目录的嵌套 node_modules 中，**profile 的 `@deepseek-ai/` 下只有 cosmokit / schemastery**。
- profile 安装本地插件用 `file:/root/dsh-plugins/<pkg>`（pnpm 拷贝，非 symlink）；**拷贝不刷新**：改完必须 `cp -f lib/*.js` 到 profile 或 `rm -rf node_modules/<pkg> && pnpm install --offline`。
- 硬链接农场陷阱：`edit` 工具 temp+rename 会断链；patch yaml 与 lib 产物同理。
- host 半改动需重启 `dsh-web.service`；client 半 500ms 轮询热更。
- 探针实例：`dsh web --port 3099 --patch /tmp/x.yml`，避免污染生产 profile。

## 工程约束

- 一小步一提交，提交信息 `<编号>-<阶段名>: <一句话中文>`（gen24-admin 范式）。
- 文档先行：设计未对齐不写实现代码（P1 起才动代码）。
- 本仓库独立 git；`/root/dsh-plugins` 工作区已有他人未提交改动，不得混入本仓库提交。
- 每阶段必须可回滚：安装前打快照、结束后 `git status` 干净。

## 安全约束

- 纯前端插件：不新增 host 路由、不读会话文件系统、不扩大 LAN 暴露面（G3）。
- 成员数据只存 localStorage，不含会话正文；导出功能也必须只导出 id + 分组名。
- 不把任何 token / 会话内容写进文档或提交历史。
