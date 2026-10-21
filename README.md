# dsh-session-groups —— DSH 会话「自定义分组」

> 给 DeepSeek Harness（DSH）Web 会话侧栏增加第四种分组方式：**自定义分组**。
> 用户自建分组、把会话拖进去、拖出来；本质是**显示层**的唯一性归组，不改动会话在本地的真实排列。

## 当前状态

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| P0 | 探测 DSH 会话页构建逻辑 / 扩展点 / 可行性 | ✅ 完成（2026-10-21） |
| P1 | vendor 管线 + fork 骨架安装冒烟 | ✅ 完成（2026-10-21，零功能变化已上线） |
| P2 | 自定义分组数据模型 + 第四种分组模式 + 渲染 | ✅ 完成（2026-10-21，探针 3099 验收：菜单第四项、分区渲染、新建分组、刷新保留、0 报错） |
| P3 | 拖入 / 拖出 / 分组管理菜单 | ⏳ 未开始 |
| P4 | 与搜索、归档、手动排序、置顶、水印的协同打磨 | ⏳ 未开始 |
| P5 | e2e 验证 + 文档 + 发布/回滚手册 | ⏳ 未开始 |

## 三条关键结论（P0）

1. **「分组方式」菜单是硬编码的，没有扩展点。** 三个选项写在 `@deepseek-ai/dsh-client-ui-workspace` 的 `ViewOptionsMenu` 里，没有任何 slot / 注册表；`sidebar.workspaces` hole 是 `kind: "single"`，全 App 只允许一个会话浏览器注册者。
2. **拖拽基础设施已存在但只支持「组内重排」。** `commitSessionDrag` 只按 `activeDrag.accountKey` 重排己方账号组，**跨工作区/跨分组搬移会话没有实现**，需要我们自己加。
3. **要实现原生第四种模式，只能 fork 该插件包。** 无模块 override / alias 能力（见 `docs/04-extension-points.md`），因此 `docs/05-options.md` 推荐「vendor + 补丁」方案（MIT 许可允许，保留署名）。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [docs/01-purpose.md](docs/01-purpose.md) | 目的、用户需求原文、目标与非目标、验收标准 |
| [docs/02-constraints.md](docs/02-constraints.md) | 技术/环境/工程/安全四类硬约束 |
| [docs/03-architecture.md](docs/03-architecture.md) | DSH 客户端插件加载链路、workspace 包结构、数据流与行号锚点 |
| [docs/04-extension-points.md](docs/04-extension-points.md) | slot/hole 清单、可注入内容、拖拽可复用点、patch 层能力 |
| [docs/05-options.md](docs/05-options.md) | 四种实现路线对比与推荐 |
| [docs/06-design-draft.md](docs/06-design-draft.md) | 自定义分组设计草案 + **待裁决问题清单** |
| [docs/07-roadmap.md](docs/07-roadmap.md) | 阶段拆分、提交点、验收标准 |
| [docs/08-conventions.md](docs/08-conventions.md) | 工程规范：vendor 升级、构建、安装、回滚、提交 |
| [docs/09-risks.md](docs/09-risks.md) | 风险与缓解 |
| [docs/10-finding-duplicate-session-id-menu.md](docs/10-finding-duplicate-session-id-menu.md) | 「复制 Session ID / 复制会话ID」重复项定性 |
| [docs/11-maintenance-log.md](docs/11-maintenance-log.md) | 维护日志：pnpm 安装链修复（M1）、右键菜单去重与改造（M2） |

## 环境基线

- DSH `0.2.1-rc.2`（MIT），profile = `web`，服务 `dsh-web.service`
- 核心客户端包位置：`/root/.nvm/versions/node/v22.21.1/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/`（305 个包）
- 被 fork 目标：`@deepseek-ai/dsh-client-ui-workspace@0.2.1-rc.2`（`lib/client.js` 232,668 B / 5,354 行，非压缩、保留注释）
- 本机插件开发仓库：`/root/dsh-plugins/`（独立 git 仓库，工作区当前有其它未提交改动，**本仓库提交不要混入**）

## 本机安装方式（P1 落地）

pnpm 侧存在**预先存在**的解析故障：profile 依赖 `dsh-preset-workbench@^0.1.3` 在 npmmirror 上已无法解析（只剩 1.0.2），
导致任何 `dsh plugin add` 都会 `ERR_PNPM_NO_MATCHING_VERSION` 失败。因此本仓按 profile 里 `dsh-ops` 同款方式**手工 link 安装**：

```bash
# 1) profile 依赖登记（已做）
#    /root/.dsh/profiles/web/package.json:
#      dependencies["dsh-session-groups"] = "link:/root/dsh-session-groups"
#      dsh.profile.bundles += "dsh-session-groups"
# 2) 软链（已做）
ln -sfn /root/dsh-session-groups /root/.dsh/profiles/web/node_modules/dsh-session-groups
```

好处：源码目录即生效目录（无硬链接农场、无需 `cp -f`），改完刷新页面即可。
回滚：删 bundles 里那一行 + 删软链 + 恢复快照 `20261021-193308-pre-session-groups`。

## 快速命令（P1 之后生效）

```bash
node scripts/vendor.mjs     # 从安装目录重新 vendor 上游 client.js 并校验 sha256
node scripts/build.mjs      # pristine + patches → lib/client.js + lib/index.js
node scripts/verify.mjs     # 校验 lib/client.js 与 pristine/patch 一致、id 与注入声明正确
```
