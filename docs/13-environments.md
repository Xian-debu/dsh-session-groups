# 13 · 其它环境部署指南与难度评估

> 本文件回答三件事：**我这台机器是怎么装、怎么管、怎么回退的**；**换一台机器要注意什么**；
> **每个环境的难度与坑**。安装/升级/卸载的命令细节见 [12-release-rollback.md](12-release-rollback.md)，
> 一键脚本见 [scripts/install.mjs](../scripts/install.mjs)。

## 13.0 先记住三条硬事实

1. **这是「替换核心会话浏览器」的插件，不是叠加式小挂件。** 它把自己的 `cordis.patch.yml` 打进
   profile 层：`ui-workspace`（原生会话侧栏）被 `disabled: true`，换成本包注册的同名 slot。
   因此**同一时刻只能有一个会话浏览器**，本包与原生侧栏不能共存，也不能与其它 fork 了
   `dsh-client-ui-workspace` 的插件共存。
2. **分组数据在浏览器 localStorage 里，不在 DSH 后端。** 键名 `dsh.sessionGroups.v1`，
   按 **origin（协议+主机+端口）** 隔离。换端口（3080 → 3099）、换域名、换浏览器、开无痕，
   都会看到「没有分组」——这不是丢数据，是看错了 origin；把同一 origin 的 localStorage 值复制过去即可。
3. **插件集合只在 dsh web 进程启动时装载。** 装/卸/换版本后必须重启进程；否则你会看到
   「文件已经变了、界面没变」甚至旧插件仍在注入菜单项（本仓 docs/10 记录过一次真实案例）。

## 13.1 我的环境（开发与验收基线）

| 项 | 值 |
| --- | --- |
| 宿主 | Windows 11 + WSL2（Ubuntu），内核 5.15.133.1-microsoft-standard-WSL2 |
| 发行版内 | systemd 255；Node **v22.23.2**；Google Chrome（headless 探针用） |
| DSH | `@deepseek-ai/dsh` **0.2.1-rc.2**（MIT），安装在 nvm 全局目录 |
| profile | `~/.dsh/profiles/web`（服务化：`dsh-web.service`，监听 3080） |
| 上游包 | `@deepseek-ai/dsh-client-ui-workspace@0.2.1-rc.2`，`lib/client.js` 232,668 B / 5,354 行 |
| 安装形态 | **源码目录即生效目录**：profile 依赖写 `link:/root/dsh-session-groups`，并在 node_modules 下建同名软链；改完刷新浏览器即生效（无需拷文件） |
| 数据 | 浏览器 localStorage `dsh.sessionGroups.v1`（当前 3080 origin） |

### 我如何控制它（运维动作）

- **发布门禁三件套**：`node scripts/build.mjs`（pristine+patches 机械重打）→
  `node scripts/verify.mjs`（11 条不变量，含「已提交产物 == 重新构建」逐字节比对）→
  `node scripts/e2e.mjs`（自起临时 headless Chrome 跑 S1–S9）；GUI 改动另用 3099 探针实例
  + CDP 做交互断言（见 docs/07 各阶段验收记录）。
- **回退**：每一步都留了退路——代码层 `git`；profile 层 `scripts/install.mjs --remove`；
  数据层删 localStorage 键；整机层安装前对 profile 打快照（见 docs/12 §12.2）。
- **探针隔离**：探针跑在**独立端口**（3099）+ 独立 Chrome profile（`/tmp/cdp-prof-*`），
  不碰生产 3080 的 localStorage；headless 必须 `--no-sandbox`（root 下）并每次重启，
  否则 CDP 会 timeout（踩坑记录见 docs/11）。

## 13.2 换环境的通用步骤

不论 Linux / macOS / 容器，逻辑都是四步，只有「重启服务」的方式不同。

### 1) 取代码 + 构建

```bash
git clone https://github.com/Xian-debu/dsh-session-groups.git && cd dsh-session-groups
node scripts/build.mjs && node scripts/verify.mjs      # 期望 PASS (11 checks)
```

构建只需要 **node 22 + git**，不需要联网、不需要装 DSH 依赖（产物已提交在仓库里，
重新构建只用于确认「产物 == pristine + patches」）。

### 2) 装进 profile

```bash
node scripts/install.mjs --profile web --dry-run   # 先看要改什么
node scripts/install.mjs --profile web             # 依赖登记 + bundles 追加 + 软链
```

### 3) 重启 dsh web

```bash
sudo systemctl restart dsh-web          # Linux + systemd
# macOS / 手动：结束旧的 dsh web 进程后重新 `dsh web`
# 容器：docker restart <container>（或让编排拉起）
```

### 4) 断言

```bash
dsh --profile web --dump-config | grep -n "session-groups"
```

页面侧栏「View options（视图选项）→ Custom groups」出现即成功。

卸载/回滚同一条命令反向：`node scripts/install.mjs --remove` → 重启 → 原生三选项回来。
**分组数据不会被卸载删除**（在浏览器里），需要清理时单独处理（docs/12 §12.8）。

## 13.3 各环境要点与难度

难度按「是否需要改系统、是否需要自己造基础设施」评，★ 越多越麻烦。

### A. Linux + systemd（与作者同构）★☆☆☆☆

与本文基线一致。唯一注意：`dsh` 在 nvm/全局 npm 的 bin 里，systemd 单元要用绝对路径，
否则服务环境里会 `command not found`。装完 `systemctl restart dsh-web` 即可。

### B. macOS（launchd 或前台运行）★★☆☆☆

- 没有 systemd：前台跑就 Ctrl-C 重启；用 launchd 的话 `launchctl kickstart -k gui/<uid>/<label>`。
- 软链没问题（APFS 支持目录软链），`scripts/install.mjs` 可直接用。
- 如果 DSH 跑在默认的 `~/.dsh` 以外路径，用 `--home` 指定。
- macOS 自带 node 可能太旧，先 `node -v` 确认 ≥ 22。

### C. Windows 原生（非 WSL）★★★☆☆

- 目录软链需要**管理员权限或开发者模式**；脚本已对 win32 改用 **junction**，但仍建议管理员运行。
- profile 的 `package.json` 里写的是 `link:<绝对路径>`，一旦移动仓库位置就要重跑
  `install.mjs`（它会自动 retarget 软链）。
- 服务化通常用 nssm/winsw 之类，重启方式随你；核心仍是「进程重启才装载插件」。
- DSH 本身在 Windows 原生上的支持以官方为准；本仓**未**在 Windows 原生验收，属未验证环境。

### D. 容器（Docker / Podman）★★★☆☆

- **DSH_HOME 必须挂卷**，否则重启容器 = 重装插件、丢 sessions。
- **分组数据在用户浏览器里**，不在容器里：换容器端口/域名会看不到旧分组（见 13.0 第 2 条）。
- 镜像里要有 node ≥ 22 与 git（仅构建需要；运行时用仓库里已提交的 `lib/client.js`）。
- 无 systemd：用编排的重启策略或 `docker restart`。

### E. 远程 / 共享 DSH（多用户、反代）★★★★☆

- 反代换域名 → localStorage origin 变了，**每个用户的分组各自独立**，通常正是期望行为。
- 反代需保证 query 里的 token 与静态资源路径不被改写；本插件不改协议，只跑在浏览器端。
- 多用户共享一个 DSH 实例时，会话列表共享、分组**每人本地**（互不干扰）。
- 难度主要在反代与鉴权，不在本插件。

### F. 不同 DSH 版本（上游漂移）★★★☆☆

本仓是 `dsh-client-ui-workspace` 的 fork，**与上游版本强绑定**：

```bash
node scripts/vendor.mjs    # 重新抓当前安装的 DSH 里的上游 client.js（更新 vendor/upstream.json）
node scripts/build.mjs     # 重打全部 patch
node scripts/verify.mjs    # 断言 inject 集合、模块 id、产物一致性
node scripts/e2e.mjs --url ...   # 交互冒烟
```

上游改动若碰到 patch 的上下文，`git apply` 会**明确报错**（不会静默产出坏产物），
此时按 [patches/README.md](../patches/README.md) 的锚点重做对应 patch。
本仓只在 DSH **0.2.1-rc.2** 上验收过；新版本请先跑上面四步，失败就退回旧版本（docs/12 §12.7）。

## 13.4 难度总表

| 环境 | 安装 | 重启 | 主要坑 | 难度 |
| --- | --- | --- | --- | --- |
| Linux + systemd | 脚本 1 条 | systemctl | dsh 绝对路径 | ★☆☆☆☆ |
| macOS | 脚本 1 条 | 前台/launchd | node 版本 | ★★☆☆☆ |
| Windows 原生 | 脚本（管理员） | 服务/进程 | 软链权限、路径迁移 | ★★★☆☆ |
| 容器 | 脚本 1 条 | 容器重启 | 挂卷 DSH_HOME、origin 变化 | ★★★☆☆ |
| 多用户/反代 | 脚本 1 条 | 反代重启 | 域名/token/origin | ★★★★☆ |
| 换 DSH 版本 | vendor+build+verify | 同左 | patch 上下文漂移 | ★★★☆☆ |

## 13.5 部署后自检清单

- [ ] `dsh --profile <name> --dump-config` 输出里有 `dsh-session-groups`，且 `ui-workspace` 为 disabled
- [ ] 页面「View options（视图选项）」菜单里出现 **Custom groups**
- [ ] 新建分组 → 刷新 → 分组还在（localStorage 生效）
- [ ] 拖一个会话进组 → 刷新 → 仍在组内
- [ ] 键盘：Tab 到分组头，Enter 折叠，F2 改名，Esc 取消
- [ ] 卸载后重启，原生三选项回来，且会话数据无损
