# patches/

对 `vendor/client.pristine.js` 的文本补丁（`git apply` 格式），按应用顺序命名 `0001-*.patch`。

原则：
- 只增不改：新增代码尽量整块插入，减少与上游行的耦合。
- 必须改上游行时，在 `docs/03-architecture.md` 锚点表登记行号与用途。
- 每个补丁在 `scripts/build.mjs` 里按编号顺序应用，任一失败即中止并打印 hunk。
