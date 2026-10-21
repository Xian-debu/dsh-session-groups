# vendor/

存放上游 pristine 副本与来源元数据，保证可复现构建。

- `client.pristine.js`：`@deepseek-ai/dsh-client-ui-workspace/lib/client.js` 的原样拷贝（当前 0.2.1-rc.2，232,668 B）。
- `upstream.json`：`{package, version, file, sha256, capturedAt, history[]}`，由 `scripts/vendor.mjs` 写入。

不要手工编辑 pristine 文件；改行为请加补丁。
