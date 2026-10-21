# 10 · 发现：「复制 Session ID」与「复制会话ID」重复

## 现象

会话行右键菜单同时出现 **复制 Session ID** 与 **复制会话ID** 两项，功能相同。

## 定性（已确认）

| 来源 | 位置 | 证据 |
| --- | --- | --- |
| DSH 核心（内置） | `@deepseek-ai/dsh-client-ui-workspace/lib/client.js:4807` `"menu.sessionId": "复制 Session ID"`（toast 键 4808） | 0.2.1-rc.2 起核心自带该菜单项 |
| 第三方插件 | `/root/.dsh/profiles/web/node_modules/dsh-session-id-copy/src/client/index.jsx:100`，id `copy-session-id`、order 500、`ctx.slots.inject("sidebar.workspaces.session.menu.item", …)` | 本机插件仓库 `/root/dsh-plugins/dsh-session-id-copy`（提交 `59befa4` 当初新增时核心还没有） |

**结论**：重复由「核心后来补上同一功能 + 第三方插件仍在注入」造成，非 DSH bug。

## 处置选项（待用户裁决）

1. **停用/卸载 `dsh-session-id-copy`**（推荐）：核心已覆盖，少一个注入点；`dsh plugin --profile web remove dsh-session-id-copy`。
2. 保留插件、把标签改成「复制会话ID（插件）」并挪到菜单更下方（需要改第三方源码）。
3. 只保留插件项、隐藏核心项（需要 patch core 的菜单渲染，成本高，不推荐）。

## 与本项目的关系

自定义分组会用 session id 作为成员键，右键「复制 Session ID」（核心项）就是取 id 的入口；处置后交互一致，不影响本插件。
