# 14 · 已知问题与限制（当前版本 v1.0.0）

> 这份清单只写**我实际验证过**或**从代码结构可以直接推出**的问题；每条都给出影响面、
> 触发条件与规避方式。未验证的猜测不列。

## 14.1 架构性限制（改不掉，属于方案本身）

### K1. 与上游 `dsh-client-ui-workspace` 强绑定 ★★★
- **原因**：原生会话侧栏的「分组方式」菜单是硬编码的（无 slot/注册表），要做第四种模式只能
  fork 整个包；本仓 `lib/client.js` 是「上游快照 + 7 个 patch」机械重打的产物。
- **影响**：DSH 升级后上游 `client.js` 变化可能让 patch 打不上（`git apply` 报错），或打完在
  新版本上行为不符。
- **规避**：升级 DSH 后依次跑 `vendor → build → verify → e2e`（docs/13 §13.3 F）；失败就退回旧版
  （docs/12 §12.7）。**不要**跳过 verify 直接上线。

### K2. 一个 DSH 只能有一个会话浏览器 ★★
- **原因**：`sidebar.workspaces` 是 `kind: "single"` 的 hole，且本包用 patch 禁用了 `ui-workspace`。
- **影响**：不能与原生侧栏或其它 fork 了同一包的插件共存；两个一起装会互相顶掉。
- **规避**：装本包前确认 profile 里没有别的会话侧栏替代品；卸载即可恢复原生。

### K3. 分组数据在浏览器 localStorage，不在服务端 ★★★
- **键**：`dsh.sessionGroups.v1`，按 origin 隔离。
- **影响**：① 换端口/域名/浏览器 = 看不到分组；② 清站点数据 = 分组丢失（会话本身不丢）；
  ③ 不同设备之间不同步；④ 服务端备份不包含分组。
- **规避**：在「设置 → 站点数据」里把该键的值复制到新 origin；需要长期保存就手动导出 JSON
  （见 14.3 迁移片段）。

### K4. 插件集合只在进程启动时装载 ★★
- **现象**：装/卸/改完文件刷新页面没变化；更隐蔽的是——**旧插件仍在内存里继续注入菜单项**
  （本仓 docs/10 记录过真实案例：已卸载的 `dsh-session-id-copy` 与新的「复制 Session ID」
  同时出现，根因是 dsh web 进程比 package.json 的修改更早启动）。
- **规避**：任何安装/卸载后**重启 dsh web**；排查「菜单多了一项/少了一项」先看进程启动时间
  （`systemctl show dsh-web -p ActiveEnterTimestamp`）与文件修改时间。

## 14.2 功能边界（有意为之的取舍）

### K5. 行级菜单是「⋯」按钮，不是鼠标右键 ★
- 宿主没有渲染 `contextmenu`，行操作菜单由行内 `⋯` 按钮触发。README 早期写作「右键菜单」，
  docs/04、docs/06 已更正。功能等价，只是入口不同。

### K6. 拖拽只在本插件容器内有效 ★★
- 支持：拖进分组、拖出分组、组内重排提示（宿主排序）、折叠头悬停 600ms 自动展开。
- 不支持：跨工作区/跨账号拖拽（宿主 `commitSessionDrag` 只处理己方账号组，本包没有重写整套
  DnD 基础设施）。需要跨工作区搬会话时请用原生方式。

### K7. 组内不做自由排序 ★
- P4d 的取舍：组内顺序仍由宿主的排序策略决定（创建/更新时间），本包只做「归组」这一层。
  原因：引入独立 order 字段会让「搜索/归档/手动排序」的语义互相打架，收益不抵复杂度。

### K8. 删除分组不可撤销 ★★
- 行为：删除分组时该组会话**回到「未分组」**（`assignments` 里对应键被过滤掉），会话本体不受影响。
- 目前没有 undo，也没有二次导出的删除前快照；误删只能重新拖回新建的同名分组。

### K9. 无内置导入/导出 UI ★
- 迁移/备份靠手动复制 localStorage 值（片段见 14.3）。做成 UI 需要新面板与文件读写权限，
  当前版本刻意不做。

### K10. 水印分页是「每组默认 5 行 + Show N more」 ★
- 大分组不会一次性铺满侧栏；「Show more」状态不进 localStorage（刷新回到 5 行），
  只有折叠状态持久化。这是为了避免把临时展开状态也写进持久层。

### K11. 只提供 zh / en 两种文案 ★
- 其它语言回退到英文；新增语言需要同时补 `lib/client.js` 里的两份词典与 `patches/` 里的
  locale 键（见 docs/08）。

### K12. 键盘可达只覆盖分组头与菜单 ★★
- 已做：Tab 聚焦分组头、Enter/空格折叠、F2 改名、Shift+F10/上下文键开菜单、
  方向键/Home/End 在菜单内移动、Esc 取消、删除确认 Delete 自动聚焦。
- 未做：会话行之间的方向键导航、拖拽的键盘替代（宿主没有暴露焦点模型，硬做会与列表滚动冲突）。

## 14.3 数据迁移片段（手动导出/导入）

```js
// 浏览器 Console：导出（在当前 origin 下）
copy(localStorage.getItem("dsh.sessionGroups.v1"))
// 导入（目标 origin，先确认 key 合法再写）
localStorage.setItem("dsh.sessionGroups.v1", <粘贴的 JSON 字符串>); location.reload()
```

结构：`{ version: 1, groups: [{ id, name }], groupOrder: [...], assignments: { [sessionId]: groupId },
collapsed: { [groupId]: true } }`。**sessionId 是裸 id**（不带 `session:` 前缀），跨机器迁移时
如果会话 id 不同，assignments 会指向不存在的会话（无害，显示为未分组）。

## 14.4 测试与工具链限制

### K13. e2e 需要本机 Chrome ★★
- `scripts/e2e.mjs` 自起 headless Chrome（root 下必须 `--no-sandbox`），并需要一个运行中的
  DSH Web 实例（默认探针端口 3099）。CI 里只跑构建与静态不变量（不跑 e2e），
  因为 GitHub runner 没有 DSH 安装。

### K14. verify 的「上游一致性」检查在离线环境自动降级 ★
- 有本机 DSH 时校验 V1b/V1c/V4（版本、sha256、inject 集合）；没有时退化为 V1d（快照自校验）
  + 与 `vendor/upstream.json` 记录比对。CI 走降级路径，属预期行为。

### K15. `dsh plugin add` 在本机历史上不可靠 ★★★
- 本机曾因 profile 依赖里 `dsh-preset-workbench@^0.1.3` 在镜像源被撤版，任何
  `dsh plugin add` 都 `ERR_PNPM_NO_MATCHING_VERSION`；因此安装脚本走**手工 link**，不依赖 pnpm。
- 其它机器若 pnpm 正常，也可以 `dsh plugin --profile web add /path/to/repo`，但**软链方式
  可预测性最好**，本仓默认推荐 `scripts/install.mjs`。

## 14.5 与其它插件的历史纠纷（现状：已澄清，无需处理）

- **「复制 Session ID」重复项**：来自已卸载的 `dsh-session-id-copy` 残留在旧进程内存中；
  重启 dsh web 后只剩本包与 `dsh-session-md-export` 的项。详见 docs/10。
- **`dsh-context` 的 Minified React error #311**：与分组无关的上游 Rules of Hooks 违规，
  只影响其「上下文」面板渲染，刷新即恢复；不在本仓修复范围（该插件的独立问题，
  与本仓无代码交集；如需跟踪请到 dsh-context 上游提 issue）。
