# Stage Report (2026-04-23)

本文档记录 CubeScope 在 `2026-04-23` 的阶段性状态，目标是提供一份可归档、
可引用、可复盘的项目快照，回答四个问题：

1. 当前项目已经完成到什么程度
2. 哪些关键能力已经进入稳定 alpha 边界
3. 还剩哪些外部阻塞没有关闭
4. 下一阶段最值得投入的工作是什么

## 一句话结论

CubeScope 目前已经达到一个私有 `0.1.0-alpha.1` 本地发布候选状态。

如果以“私有仓、本地可复现、可支撑软件论文附录材料”的标准衡量，项目已经
进入收口阶段；而截至本文档的最新更新，先前剩下的两个本地硬门槛已经关闭：

- 一个真正可公开、稳定、具备 `CORS + HTTP range` 的远程样例，已接入
- 一次真实 `Node 22` 本地运行时验证，已通过

## 当前阶段判断

当前项目不再属于“原型堆叠”阶段，而是一个具备以下特征的 alpha 候选：

- 公开 SDK 身份已经统一为 `@cubescope/web`
- 公开 API 边界已经收敛到真实可用面
- Rust/WASM -> worker -> renderer -> wrapper 的主链已可复现
- 本地验证链已经覆盖 build、test、benchmark、browser matrix、pack consumer
- 私有 alpha 的代码侧核心门槛基本压平

对应结论可以在以下文件中交叉验证：

- `output/alpha/local-alpha-summary.json`
- `docs/ALPHA_RELEASE_CHECKLIST.md`
- `docs/NEXT_DEVELOPMENT_TASKS.md`
- `docs/ROADMAP.md`

## 已完成的核心工作

### 1. 公开身份与 alpha 产品面

以下公开面已经进入相对稳定状态：

- npm 包身份：`@cubescope/web`
- 主公开类：`CubeViewer`
- 兼容导出：`EnviViewer`
- 主加载入口：`load(source)`
- 兼容别名：`loadFile(hdrFile, dataFile)`
- 生命周期接口：`init()`, `unload()`, `destroy()`
- 运行时更新：`updateConfig()`
- 基础交互：`setBands()`, `getSpectralProfile()`
- 空间参考：`pixelToWorld()`, `worldToPixel()`

相关合约已经写入：

- `docs/API.md`

### 2. ENVI 空间参考首轮落地

本轮已经完成 ENVI 空间参考的第一阶段闭环：

- 解析 ENVI `map info`
- 解析 `coordinate system string`
- 归一化为 `CubeHeader.spatialReference`
- 暴露 `pixelToWorld()` / `worldToPixel()`
- demo 与 fixture 已覆盖像素/世界坐标展示链路

本轮边界也已经明确：

- 只做元数据归一化与坐标映射
- 不做实时重投影
- 不引入 `proj4`
- 渲染仍严格停留在像素空间

### 3. 本地 / 远程 ENVI 读取主链

当前已经具备两条真实主链：

- `envi-local`
- `envi-http`

其中远程链路已经支持：

- 浏览器可用的 `HTTP range`
- sample catalog
- deterministic local HTTP fixture
- 候选 public sample 的 preview / qualify / validate 流程

当前已完成的是“本地可验证远程链路”，尚未完成的是“真正公开可用的外部远程
样例”。

### 4. 运行时内部边界重构

`viewer-runtime` 已经从“大一统实现类”收敛为 orchestration shell。

目前已存在的内部 seam 包括：

- `src/runtime/render-session.js`
- `src/runtime/work-scheduler.js`
- `src/runtime/worker-message-router.js`
- `src/runtime/runtime-reaction-plan.js`
- `src/runtime/runtime-work-executor.js`
- `src/runtime/runtime-lifecycle-controller.js`
- `src/runtime/runtime-transition-controller.js`
- `src/runtime/runtime-view-controller.js`
- `src/runtime/runtime-policy.js`
- `src/runtime/worker-dispatch-policy.js`
- `src/runtime/worker-pool.js`

这意味着：

- renderer / runtime / worker protocol 的边界已经明显清晰
- 后续不应再机械拆小模块
- 下一阶段应优先回到 release gate 和用户可见能力

### 5. 渲染兼容与浏览器恢复链

渲染链路已经完成以下关键工作：

- WebGL compatibility renderer 已落地
- `auto renderer` 已支持会话级 `WebGPU -> WebGL` 降级
- 修复了浏览器真实约束：
  同一 `canvas` 上在 WebGPU device loss 后不能可靠地直接切到 WebGL，
  当前恢复路径会重建 render canvas 后再恢复到 WebGL

这部分已经不只是“能 fallback”，而是“浏览器恢复链真正可验证”。

### 6. 本地可复现与交付壳层

以下交付件已经就位：

- `README.md`
- `CITATION.cff`
- `LICENSE`
- `docs/REPRODUCIBILITY.md`
- `docs/ALPHA_RELEASE_CHECKLIST.md`
- `docs/REMOTE_SAMPLE_WORKFLOW.md`

同时已经具备：

- synthetic fixture
- benchmark 输出
- browser matrix 输出
- pack consumer 输出
- alpha summary 输出

这已经基本满足软件论文附录和开源发布前的“证据链”要求。

## 本地验证结果

截至 `2026-04-23`，完整本地 alpha 验证链已经通过：

- `npm run verify:alpha`

当前本地报告中的关键状态如下：

- `localAlphaVerification = passed`
- `deterministicHttpFixture = passed`
- `registeredRemoteSampleCatalog = passed`
- `webglFallback = passed`
- `browserMatrixLocal = passed`
- `publicRemoteSample = passed`
- `node22LocalRuntime = passed`

### 当前已通过的验证项

- unit tests：`27` files / `98` tests passed
- smoke tests：`4/4` passed
- browser matrix：`2/2` scenarios passed
- benchmark：local + http 两条场景均产出指标
- pack consumer：tarball 安装与导入验证通过

### 当前已产出的验证证据

- `output/alpha/local-alpha-summary.json`
- `output/browser-matrix/latest.json`
- `output/benchmark/latest.json`
- `output/pack-consumer/latest.json`
- `output/samples/latest.json`
- `output/samples/public-latest.json`
- `output/toolchain/local-toolchain.json`
- `output/toolchain/node22-local-verification.json`

## 仍未关闭的门槛

### 1. 外部 CI

GitHub Actions on Node 22 目前仍处于 deferred 状态。

这一项在当前私有 alpha 阶段不是主动 blocker，但它仍然是未来公开发布时的
外部发布门槛之一。

## 当前完成度评估

如果按不同目标衡量，当前项目完成度可以这样看：

### 以“私有 alpha + 本地论文支撑材料”为目标

完成度约为 `95%+`。

理由：

- 核心 SDK 主链已稳定
- 本地可复现验证链已闭环
- 渲染兼容链和恢复链已通过验证
- 文档、benchmark、pack 验证都已具备

### 以“可立即公开发布 alpha”为目标

完成度约为 `85% - 90%`。

差距主要集中在：

- 外部 CI
- 仓库公开与首个 public tag 的时机控制
- 更广的真实浏览器 / GPU matrix

## 当前最重要的项目判断

当前最值得强调的判断不是“还差很多功能”，而是：

1. **核心代码主干已经站稳**
2. **本地 alpha 验证体系已经形成**
3. **剩余问题主要是外部发布条件，而不是核心架构仍不成立**

这意味着下一阶段的优先级应该是：

- 先关掉外部门槛
- 再进入新的能力扩展

而不是重新回到大规模内部重构。

## 下一步建议

按优先级排序，建议下一阶段优先做以下三件事：

1. 维持并观察 shipped public sample 的外部稳定性
2. 在准备公开之前补上外部 CI
3. 把更多精力转回真实用户价值能力，而不是继续围绕 alpha 壳层打转

在这些事项推进的同时，再进入以下方向会更合理：

- 可见光 / 多光谱扩展
- pixel-space overlay
- GeoTIFF / COG / Zarr 等后续数据源
- 更广的浏览器 / GPU matrix

## 归档备注

本报告记录的是 `2026-04-23` 的项目状态，属于一个阶段性快照。

如果后续继续推进，建议采用同样格式新增下一份阶段报告，而不是反复覆盖本文件。
