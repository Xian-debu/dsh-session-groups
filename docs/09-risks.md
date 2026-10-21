# 09 · 风险与缓解

| # | 风险 | 影响 | 缓解 |
| --- | --- | --- | --- |
| R1 | 上游 `client.js` 升级后补丁冲突 | P1 之后每次 DSH 升级都要重打 | vendor 管线 + `verify.mjs` 门禁；上游变更只增块；补丁集中，冲突时打印 hunk |
| R2 | fork 后拿不到上游新功能（记忆/多选/新交互） | 功能落后 | 每次升级跑 `vendor.mjs` 重基线；`docs/03` 锚点表随版本更新 |
| R3 | 禁用 `ui-workspace` 影响其它插件 | 依赖该 hole 的插件（复制 ID、hover 动作）失效 | 本包原样注册同样 5 个 hole；P1 冒烟专门验证 |
| R4 | 双挂载 / 行冲突 | loader 启动失败（duplicate prefix route） | patch 用 `- id:` 精确禁用；`verify.mjs` 断言只出现一行 |
| R5 | localStorage 丢失（清缓存/换浏览器） | 分组消失 | 导出/导入 JSON；v1 文档明示；Q6 若选 host 持久化则升级方案 |
| R6 | 会话被彻底删除后残留引用 | 幽灵成员计数 | 渲染时按 `sessions.list.byId` 惰性剪枝 |
| R7 | 拖拽跨组与核心拖拽状态互相干扰 | 拖拽错乱、行跳到错误位置 | 自定义拖拽独立 commit；先 `sessionDragOrder` 判同组，跨组走自己的 assign；P3 e2e 覆盖 |
| R8 | 搜索/归档/排序组合状态爆炸 | 边角渲染错误 | 6.2 显示规则表逐条 e2e；`animationResetKey` 纳入自定义模式 |
| R9 | 大规模会话（286+）性能 | 侧栏卡顿 | 复用核心水印分页/虚拟行；不在渲染期做 O(n²)；P4 压测 |
| R10 | MIT 合规 | 法务风险 | 保留上游版权头与 `NOTICE`，仓库注明 fork 来源与版本 |
