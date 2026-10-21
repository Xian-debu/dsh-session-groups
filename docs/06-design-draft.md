# 06 · 自定义分组设计草案（v1）

> 状态：**草案，待与用户逐条对齐**。「推荐」列是本仓库的默认取舍，用户未推翻即按推荐实现。

## 6.1 数据模型

持久化键：`localStorage["dsh.sessionGroups.v1"]`（与核心 `dsh.workspace.view.v5` 完全隔离）。

```json
{
  "version": 1,
  "mode": "custom",
  "groups": [
    { "id": "g_7f3a1c", "name": "逆向工程", "emoji": "🧩", "collapsed": false, "pinned": false },
    { "id": "g_9b2e04", "name": "论文写作", "emoji": null, "collapsed": true, "pinned": true }
  ],
  "assignments": { "<session-uuid>": "g_7f3a1c" },
  "ungroupedOrder": ["<session-uuid>", "..."],
  "groupOrder": ["g_9b2e04", "g_7f3a1c"],
  "updatedAt": 1761080000000
}
```

- **`assignments` 是唯一真相**：一个 session id 最多映射到一个 group id —— 天然满足「显示唯一性」；拖入即覆盖，拖出即 delete。
- `groupOrder` 管分组显示顺序；组内顺序由「组内排序规则」决定（见 Q4），手动模式下按会话在组内的插入顺序另存 `groupOrders: {gid: [sessionId…]}`（若 Q4 选手动才落）。
- 会话 id 一律为纯 UUID（与右键「复制 Session ID」得到的一致），不含 `session:` 前缀。
- 失效引用惰性清理：渲染时若 sessionId 不在 `sessions.list.byId`（会话已被彻底删除），从 `assignments` 里丢掉。

## 6.2 显示规则（自定义模式下）

| 情形 | 显示 |
| --- | --- |
| 已归组会话 | 只出现在其分组内；**不再出现在任何工作区分组** |
| 未归组会话 | 「未分组」区（底部、可折叠），沿用现有排序规则 |
| 置顶会话 | 顶部独立「置顶」区（沿用核心 pinned 语义），不参与归组 |
| 空分组 | 常驻显示（便于当拖放目标），显示 `0` 计数 |
| 已归档会话 | 跟随现有三档归档筛选；`default` 下不显示，`only` 下按分组显示 |
| 搜索中（query 非空） | 切到原生 `SearchResults`，**忽略分组边界**（分组不参与搜索排序） |
| 工作区树嵌套 | 自定义模式平铺，不嵌套（与「按工作区树」互斥） |

## 6.3 交互规格

**进入/退出**
- 「视图选项 → 分组方式」新增第 4 项，icon 用文件夹类，选中打勾，选中即切模式。
- 模式持久化在 `mode` 字段；刷新后保持。

**分组管理**
- 视图弹层底部新增「新建分组」（或分组区尾部 `+` 行）→ 行内输入名称（Enter 确认 / Esc 取消）。
- 分组头 hover 出现 `⋯`：重命名 / 置顶 / 折叠 / 删除。
- 分组头本身 `draggable` 调序。
- 删除分组：二次确认，组内会话回到未分组（不删会话）。

**拖拽**
- 拖会话行 → 目标分组头或组内任意行 → 高亮该组 → 放下即归组。
- 拖到「未分组」区 → 解除归组。
- 组内拖动 → 组内重排（仅在 Q4 选手动时生效）。
- 拖到非分组区域（空白/搜索框）→ 不做任何事，行回原位。
- 复用核心 DragEvent 语义（`half: before/after` + 行 `data-row-key`），但**跨组提交由我们自己的 `commitCustomDrag` 处理**（核心的 `commitSessionDrag` 只做组内重排，见 T4）。

**会话行操作菜单（新增两项；宿主实现是行内 `⋯` 按钮触发的 Menu，不是原生右键菜单）**
- 「移动到分组…」：弹出 Modal 列出全部分组 + 「未分组（移出）」（宿主的 `Menu`/`primitives` 不支持子菜单，故用 Modal 承担子菜单职责）。
- 「移出自定义分组」（仅在已归组时出现）。

## 6.4 待用户裁决问题（Q1-Q12）

| # | 问题 | 推荐 |
| --- | --- | --- |
| Q1 | 一个会话只能属于一个分组（文件夹），还是可属多个（标签）？ | **唯一归属**，符合「显示唯一性」 |
| Q2 | 未归组会话怎么显示？ | 底部独立「未分组」区，不按工作区混排 |
| Q3 | 分组能否拖拽调序 / 置顶？置顶会话放哪？ | 都能；置顶会话在顶部独立区，不参与归组 |
| Q4 | 组内排序是否沿用「手动排序 / 最近更新」开关？ | 沿用；手动时组内可拖 |
| Q5 | 搜索时是否跨分组？ | 跨分组（分组只影响浏览，不影响搜索） |
| Q6 | 只存 localStorage，还是落 profile 目录 JSON（跨浏览器）？ | v1 只 localStorage + 导出/导入 JSON |
| Q7 | 已归档会话可否被归组？ | 可保留成员关系，但只在「仅显示已归档」时可见 |
| Q8 | 分组要颜色/图标吗？ | v1 仅可选 emoji 前缀，不做取色器 |
| Q9 | 新建分组入口放哪？ | 视图弹层底部「新建分组」+ 分组区尾部 `+` |
| Q10 | 空分组是否常驻？ | 常驻（当拖放目标） |
| Q11 | 删除分组是否二次确认？ | 是 |
| Q12 | 是否需要「只在当前分组内搜索」开关？ | v1 不做 |

## 6.5 视觉与无障碍

- 复用 `dsh-client-ui-primitives` 的 chevron / folder / ellipsis 图标与既有行高（与工作区分组头一致）。
- 分组头展开态用 `aria-expanded`；拖放目标高亮用 `data-drop-target` 属性 + 主题色描边，不写死颜色。
- 键盘：分组头 Enter/Space 折叠；F2 重命名；Delete 需二次确认。
- 文案入 locale（`ctx.locale.register("workspace", …)` 扩展键 `groupBy.custom` / `group.custom.new` 等）。

## 6.6 兼容与回滚

- 核心 `dsh.workspace.view.v5` 一字不改；关掉插件后核心三选项完全复原。
- `dsh.sessionGroups.v1` 在插件禁用时保留在 localStorage（重新启用即恢复），但也提供「清空」入口。
- 卸载：删本包 + 移除 patch 两行 → 行 `ui-workspace` 恢复，无残留。
