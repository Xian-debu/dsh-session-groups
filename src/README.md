# src/

自定义分组代码（P2 起）。预计结构：

- `src/custom-groups/store.js`：`dsh.sessionGroups.v1` 的读写、唯一性校验、惰性剪枝。
- `src/custom-groups/list.js`：自定义分组列表（分组头 + 会话行 + 未分组区）。
- `src/custom-groups/drag.js`：跨组拖拽提交。
- `src/custom-groups/locale.js`：`zh`/`en` 文案键。

这些源码**不单独打包**：`scripts/build.mjs` 把它们作为文本块嵌入上游 pristine 的对应区域（与 `patches/` 一致）。
