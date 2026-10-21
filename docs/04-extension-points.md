# 04 · 扩展点清单（P0 探测结果）

## 4.1 可用的 slot / hole

| hole | kind | scope | 注册者 | 渲染点 |
| --- | --- | --- | --- | --- |
| `sidebar.workspaces` | **single** | root | workspace 插件（5220） | sidebar client 392 |
| `sidebar.workspaces.directoryFlow` | single | root | 声明于 5223 | 3932 |
| `sidebar.workspaces.session.menu.item` | list | root | 声明于 5227（inject hooks: menuOpenState + shortcuts） | 2344 |
| `sidebar.workspaces.session.row.action` | list | root | 声明于 5235 | 2348 |
| `sidebar.session.row.leading` | list | root | 声明于 5239 | 2306 |
| `sidebar.session.row.hover` | list | root | 声明于 5243 | 2154 |
| `sidebar.footer.action` / `sidebar.settings` / `sidebar.panellist` / `sidebar.toggle.badge` / `sidebar.brand.mark` / `sidebar.brand.name` / `sidebar.left.toggle` | single/list | root | sidebar 包 | — |

**结论**：会话行级（hover / leading / action / 右键项）全都可以注入；**分组模式与视图弹层不可注入**，`sidebar.workspaces` 本体唯一。

## 4.2 可复用（fork 内部直接可用）

- 拖拽：`sessionDragOrder` 2987、`commitSessionDrag` 3107、`workspaceGroupHalf` 3001、行 `onDragStart/onDragOver/onDragEnd` 2285-2292、`withinGroup` 3102。
- 行渲染：`sessionNode` 1059、水印行 `watermarkRows` / `SESSION_WATERMARK_BASE`、`FlatList` 3354-3372 的行级拖拽。
- 行右键菜单：`sidebar.workspaces.session.menu.item` 渲染处 2344，第三方示例 `dsh-session-id-copy/src/client/index.jsx:100`（`MenuItemButton` + order 500）。
- locale：`ctx.locale.register("workspace", {zh, en})`，键集以 zh 为准。

## 4.3 patch 层能力（`cordis.patch.yml`）

```yaml
- id: ui-workspace            # 按 loader 行列号定向
  disabled: true              # 关掉核心会话浏览器（行禁用即不下发其 client 半）
- insert:
    - id: session-groups
      name: dsh-session-groups
```

- 支持 `!!js` 表达式（如 `disabled: !!js ctx.get('profileContext')?.name !== 'desktop'`，见 dump-config 的 `ui-sidebar-browser` 行）。
- 同一包双挂载会因重复注册路由/前缀而整体失败（better-sidebar patch 注释记录过 "duplicate prefix route"）。

## 4.4 明确不可用

- 无模块 alias / override / monkey-patch 上游 client 模块的官方机制。
- 不能在 `sidebar.workspaces` 上再挂第二个浏览器（single + 重复渲染会崩）。
- 无「分组方式」注册表；没有公开 API 去设置 `groupBy`（store 是插件私有实例）。

## 4.5 探测方法备忘（下次复查用）

```bash
CORE=/root/.nvm/versions/node/v22.21.1/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai
grep -n "groupBy" $CORE/dsh-client-ui-workspace/lib/client.js | head -30
grep -n "slots.inject\|slots.register" $CORE/dsh-client-ui-workspace/lib/client.js
/root/.nvm/versions/node/v22.21.1/bin/dsh --profile web --dump-config | grep -n "id: ui-workspace"
```

> 注意：`dsh` 不在非登录 shell 的 PATH 里，必须用绝对路径 `/root/.nvm/versions/node/v22.21.1/bin/dsh`。
