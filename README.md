# CubeScope

[中文](#中文说明) | [English](#english)

## 中文说明

CubeScope 是一个面向 ENVI 高光谱数据集的浏览器原生、本地优先、硬件加速
viewer kernel。

当前 alpha 阶段刻意保持收敛，目标很明确：

- 加载本地 ENVI `.hdr + 数据文件` 成对文件
- 在浏览器中渲染伪 RGB 影像
- 查看元数据与像素光谱
- 在不依赖服务端栈的前提下采集基础交互性能指标

CubeScope 目前还不是完整的遥感分析工作台。它的定位是一个可嵌入、可复用的
viewer core，供后续分析插件和下游应用构建。

## Alpha 状态

- npm 包身份：`@cubescope/web`
- 当前发布目标：`0.1.0-alpha.1`
- 仓库可见性：在 alpha 验收闸门全部通过前保持私有
- 包格式：仅 ESM
- 当前浏览器目标：优先 WebGPU，同时提供 WebGL 兼容渲染路径
- 本地 smoke / benchmark 验证链：固定使用 WebGL 兼容模式，确保私有 alpha 可复现

## 运行时支持策略

- 官方发布与复现基线：`Node 22.x`
- 更高版本 Node 可以用于本地开发，但不替代发布门槛
- 当前 alpha 的权威本地运行时复验入口：`npm run verify:node22-local`

详细说明见：[docs/RUNTIME_SUPPORT_POLICY.md](docs/RUNTIME_SUPPORT_POLICY.md)

## 仓库内已验证的快速开始路径

这是当前 alpha 的主可复现路径。

### 前置要求

- Node.js `22.x`
- npm `>=10`
- 通过 `rustup` 管理的 Rust stable toolchain
- Rust target：`wasm32-unknown-unknown`
- `wasm-bindgen-cli 0.2.100`

### 安装与准备

```bash
npm ci
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.100
npm run fixtures:generate
npm run build
npm run test
```

### 启动 demo

```bash
npm run dev
```

然后在本地 Vite 服务中打开
[`/examples/`](http://127.0.0.1:5173/examples/)，并加载
`test-data/fixtures/` 下的 synthetic fixture。

### 构建可部署 demo

```bash
npm run build:demo
npm run preview:demo
```

`build:demo` 会生成 `demo-dist/` 静态站点，包含 demo 页面、synthetic fixture、
sample catalog，以及浏览器运行所需的 worker/WASM 资源。仓库同时提供
GitHub Pages workflow；当仓库公开并启用 Pages 后，推送 `main` 或手动触发
`pages` workflow 即可发布可直接访问的在线 demo。

### Synthetic Fixture

仓库自带了一个确定性的 ENVI synthetic fixture，用于 smoke test、
benchmark 和可复现截图：

- id：`cubescope-mini-cube`
- 尺寸：`48 x 48 x 32`
- interleave：`bsq`
- data type：`u16`
- byte order：`lsb`
- 生成命令：`npm run fixtures:generate`
- manifest：`test-data/fixtures/cubescope-mini-cube.json`

同一生成命令也会生成 BIL/BIP 布局变体，用于验证内部
`FormatAdapter` 和 `CubeStore` 读模型边界；主 smoke/benchmark 基线仍保持为
上面的 BSQ fixture。

## SDK 使用方式

alpha 阶段的公开 API 仍然保持类式接口。

```js
import CubeViewer from '@cubescope/web';

const container = document.getElementById('viewer');
const viewer = new CubeViewer(container);

await viewer.init();

await viewer.load({
  kind: 'envi-local',
  headerFile: hdrFile,
  dataFile: imgFile,
});
```

The same API also supports remote ENVI sources when the server honors
`HTTP range` requests:

```js
await viewer.load({
  kind: 'envi-http',
  headerUrl: 'https://example.com/cubes/demo.hdr',
  dataUrl: 'https://example.com/cubes/demo.img',
});
```

远程模式要求服务端同时允许浏览器 CORS 访问并支持 `HTTP range`。
仓库自带的 deterministic 远程样例会在开发/构建后暴露为
`/fixtures/cubescope-mini-cube.hdr` 与 `/fixtures/cubescope-mini-cube.img`。

也可以通过支持 `HTTP range` 的远程地址加载：

```js
await viewer.load({
  kind: 'envi-http',
  headerUrl: 'https://example.com/cubes/demo.hdr',
  dataUrl: 'https://example.com/cubes/demo.img',
});
```

The remote mode requires browser-visible CORS plus `HTTP range` support on the
server side.
For deterministic local validation, the repo also exposes a same-origin sample
at `/fixtures/cubescope-mini-cube.hdr` and `/fixtures/cubescope-mini-cube.img`.

### 兼容别名

`loadFile(hdrFile, dataFile)` 仍然保留用于兼容，但主入口已经固定为
`load(source)`，其中 `envi-local` 是本地工作流，`envi-http` 是远程
`HTTP range` 工作流。

## 已发布 SDK 的运行时资源布局

当前 alpha 只保留一个公开浏览器 SDK，同时暴露显式运行时资源：

- `@cubescope/web`
- `@cubescope/web/worker.js`
- `@cubescope/web/pkg/envi_parser.js`
- `@cubescope/web/pkg/envi_parser_bg.wasm`

如果你的应用会把包内资源与 ESM 入口一起对外提供，那么默认构造方式通常不需要
额外配置。对于会重写资源 URL 的 bundler，推荐显式传入资源地址：

```js
import CubeViewer from '@cubescope/web';
import workerUrl from '@cubescope/web/worker.js?url';
import wasmJsUrl from '@cubescope/web/pkg/envi_parser.js?url';
import wasmWasmUrl from '@cubescope/web/pkg/envi_parser_bg.wasm?url';

const viewer = new CubeViewer(container, {
  workerUrl,
  wasmJsUrl,
  wasmWasmUrl,
});
```

在 `0.x` 阶段，包里仍保留 `EnviViewer` 作为兼容导出别名，但推荐公开名称已经是
`CubeViewer`。

## 稳定 Alpha API

### 构造函数

```js
const viewer = new CubeViewer(container, options);
```

`options`：

- `workerUrl?: string`
- `wasmJsUrl?: string`
- `wasmWasmUrl?: string`
- `enableBackgroundStats?: boolean`
- `enableTilePreloading?: boolean`
- `rendererPreference?: 'auto' | 'webgpu' | 'webgl'`

### 方法

- `init(): Promise<void>`
- `load(source): Promise<void>`
- `loadFile(hdrFile, dataFile): Promise<void>` 兼容别名
- `unload(): Promise<void>`
- `setBands({ r, g, b }): void`
- `updateConfig(partialConfig): void`
- `getHeader(): CubeHeader | null`
- `getSpectralProfile(x, y): Promise<Float32Array | null>`
- `getPixelProbe(x, y): Promise<ViewerPixelProbeSnapshot | null>` JSON-safe probe snapshot
- `pixelToWorld(x, y): { x, y } | null`
- `worldToPixel(x, y): { x, y } | null`
- `destroy(): void`

`init()` 和 `load(source)` 会在早期初始化或数据源加载失败时 reject，同时继续发出
`error` 事件。波段选择会按已加载 header 的 `bands` 范围校验；当首选
`30/20/10` 默认组合不适合低波段数据源时，CubeScope 会自动选择安全的范围内
fallback。

当 ENVI 头信息包含 `map info` 或 `coordinate system string` 时，`getHeader()`
返回的 `spatialReference` 会带有结构化 `mapInfo` 和推导出的
`affineTransform`。

### 稳定事件

- `ready`
- `loadstart`
- `loadend`
- `header`
- `bandschange`
- `progress`
- `performance`
- `error`
- `image-clicked`

包装层仍保留以下兼容事件别名：

- `headerloaded`
- `bandschanged`

另外还有一些兼容透传事件当前依然会发出，但它们不属于最小 alpha 合约的一部分：

- `metadata`
- `statechange`
- `log`
- `destroyed`

## 二进制数据约定

CubeScope 把大二进制数据流转视为架构约束的一部分：

- 元数据和控制消息可以走普通对象传递
- tile、spectrum 等大缓冲区应通过 `Transferable` 所有权转移跨线程传递
- `SharedArrayBuffer` 是可选优化，不是 alpha 正确运行的前提

## 仓库命令

```bash
# 重建 Rust/WASM 运行时
npm run build:wasm

# 构建 SDK bundle、worker bundle 与运行时资源
npm run build

# 验证 tarball 能否被隔离 consumer app 安装并导入
npm run verify:pack

# 生成本地 alpha 验证汇总
npm run report:alpha

# 运行 contract tests 与浏览器 smoke tests
npm run test

# 生成本地浏览器矩阵报告；Chromium/Firefox/WebKit 可用时都会实测记录
npm run report:browser-matrix

# 检查当前本地 toolchain，并探测 Node 22 运行时是否可用
npm run report:toolchain

# 采集软件论文附录所需的早期 benchmark 指标
npm run benchmark

# 为候选 public remote sample 生成预览 catalog
npm run create:sample-catalog -- --id candidate-id --title "Candidate" --header-url "https://example.com/file.hdr" --data-url "https://example.com/file.img" --output public/samples/remote-samples.preview.json

# 对候选 public remote sample 做浏览器资格审查
npm run qualify:sample -- --id candidate-id --title "Candidate" --header-url "https://example.com/file.hdr" --data-url "https://example.com/file.img"

# 一键执行 preview catalog + 资格审查 + 浏览器验证
npm run validate:sample-candidate -- --id candidate-id --title "Candidate" --header-url "https://example.com/file.hdr" --data-url "https://example.com/file.img"

# 验证已注册远程样例的 HTTP range 与 demo 载入链
npm run validate:samples

# 验证 shipped public remote sample，并写出 public-tier 报告
CUBESCOPE_SAMPLE_TIER=public CUBESCOPE_SAMPLE_REPORT_PATH=output/samples/public-latest.json npm run validate:samples

# 在检测到的本地 Node 22 运行时下重跑 alpha 验证链
npm run verify:node22-local

# 不改 shipped catalog，直接验证预览 catalog
CUBESCOPE_SAMPLE_CATALOG_URL=/samples/remote-samples.preview.json CUBESCOPE_REGISTERED_SAMPLE_ID=candidate-id npm run validate:samples

# 运行完整本地 alpha 验证链
npm run verify:alpha
```

## 可复现性与文档

- 架构文档：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- API 合约：[docs/API.md](docs/API.md)
- 运行时支持策略：[docs/RUNTIME_SUPPORT_POLICY.md](docs/RUNTIME_SUPPORT_POLICY.md)
- 软件论文主稿初稿：[docs/SOFTWARE_PAPER_DRAFT_v1.md](docs/SOFTWARE_PAPER_DRAFT_v1.md)
- 软件论文主稿中文译稿：[docs/SOFTWARE_PAPER_DRAFT_v1_zh-CN.md](docs/SOFTWARE_PAPER_DRAFT_v1_zh-CN.md)
- SoftwareX 提交长度稿：[docs/SOFTWAREX_MANUSCRIPT_v1.md](docs/SOFTWAREX_MANUSCRIPT_v1.md)
- SoftwareX 提交长度稿 v2：[docs/SOFTWAREX_MANUSCRIPT_v2.md](docs/SOFTWAREX_MANUSCRIPT_v2.md)
- SoftwareX 提交长度稿 v3：[docs/SOFTWAREX_MANUSCRIPT_v3.md](docs/SOFTWAREX_MANUSCRIPT_v3.md)
- SoftwareX 提交长度稿 v4：[docs/SOFTWAREX_MANUSCRIPT_v4.md](docs/SOFTWAREX_MANUSCRIPT_v4.md)
- SoftwareX 投稿包草案：[docs/SOFTWAREX_SUBMISSION_PACKAGE_v1.md](docs/SOFTWAREX_SUBMISSION_PACKAGE_v1.md)
- SoftwareX 模板输入包：[docs/SOFTWAREX_TEMPLATE_INPUT_PACKET_v1.md](docs/SOFTWAREX_TEMPLATE_INPUT_PACKET_v1.md)
- SoftwareX 投稿填空清单：[docs/SOFTWAREX_SUBMISSION_FILL_IN_CHECKLIST_v1.md](docs/SOFTWAREX_SUBMISSION_FILL_IN_CHECKLIST_v1.md)
- SoftwareX cover letter 草案：[docs/SOFTWAREX_COVER_LETTER_DRAFT_v1.md](docs/SOFTWAREX_COVER_LETTER_DRAFT_v1.md)
- SoftwareX cover letter 草案 v2：[docs/SOFTWAREX_COVER_LETTER_DRAFT_v2.md](docs/SOFTWAREX_COVER_LETTER_DRAFT_v2.md)
- Blueprint：[docs/CUBESCOPE_BLUEPRINT.md](docs/CUBESCOPE_BLUEPRINT.md)
- 路线图：[docs/ROADMAP.md](docs/ROADMAP.md)
- 阶段报告（2026-04-23）：[docs/STAGE_REPORT_2026-04-23.md](docs/STAGE_REPORT_2026-04-23.md)
- 文档评审：[docs/DOCUMENTATION_REVIEW.md](docs/DOCUMENTATION_REVIEW.md)
- 下一阶段任务：[docs/NEXT_DEVELOPMENT_TASKS.md](docs/NEXT_DEVELOPMENT_TASKS.md)
- 远程样例工作流：[docs/REMOTE_SAMPLE_WORKFLOW.md](docs/REMOTE_SAMPLE_WORKFLOW.md)
- 复现说明：[docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md)
- Alpha 发布检查清单：[docs/ALPHA_RELEASE_CHECKLIST.md](docs/ALPHA_RELEASE_CHECKLIST.md)

## 引用

如果 CubeScope 对你的工作有帮助，请在 alpha tag 正式发布后引用对应软件版本。
引用元数据见 [`CITATION.cff`](CITATION.cff)。

## 许可证

CubeScope 使用 MIT License 发布。详见 [LICENSE](LICENSE)。

---

## English

CubeScope is a browser-native, local-first, hardware-accelerated viewer kernel
for ENVI hyperspectral datasets.

The alpha goal is narrow on purpose:

- load local ENVI `.hdr + data` pairs
- render pseudo-RGB views in the browser
- inspect metadata and pixel spectra
- measure baseline interaction performance without a server stack

CubeScope is not yet a full remote-sensing workbench. It is the reusable viewer
core that future analysis plugins and downstream applications can build on.

## Alpha Status

- npm identity: `@cubescope/web`
- release target: `0.1.0-alpha.1`
- repository visibility: private until the author-approved public release switch
  before SoftwareX submission; the local alpha acceptance gate passed on
  `2026-05-12`
- package format: ESM-only
- current browser target: prefer WebGPU, with a WebGL compatibility renderer available
- `rendererPreference: 'auto'` now degrades to WebGL for the rest of the viewer
  session after a WebGPU device-loss event; when the browser requires a fresh
  drawing context to cross from WebGPU to WebGL, CubeScope recreates the render
  canvas and resumes on the WebGL compatibility path
- local smoke / benchmark verification: pinned to the WebGL compatibility path for deterministic private-alpha validation

## Runtime Support Policy

- official release and reproducibility baseline: `Node 22.x`
- newer Node versions may still be used for local development, but they do not
  replace the release gate
- the authoritative local runtime verification entrypoint is
  `npm run verify:node22-local`

See [docs/RUNTIME_SUPPORT_POLICY.md](docs/RUNTIME_SUPPORT_POLICY.md) for the
full policy.

## Verified Quickstart From This Repository

This is the primary reproducible path for the current alpha.

### Prerequisites

- Node.js `22.x`
- npm `>=10`
- Rust stable toolchain managed by `rustup`
- `wasm32-unknown-unknown` Rust target
- `wasm-bindgen-cli 0.2.100`

### Setup

```bash
npm ci
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.100
npm run fixtures:generate
npm run build
npm run test
```

### Run the demo

```bash
npm run dev
```

Then open [`/examples/`](http://127.0.0.1:5173/examples/) in the local Vite
server and load the synthetic fixture under `test-data/fixtures/`.

### Synthetic Fixture

The repository ships a deterministic ENVI fixture for smoke tests, benchmarks,
and reproducible screenshots:

- id: `cubescope-mini-cube`
- dimensions: `48 x 48 x 32`
- interleave: `bsq`
- data type: `u16`
- byte order: `lsb`
- generation command: `npm run fixtures:generate`
- manifest: `test-data/fixtures/cubescope-mini-cube.json`

The same generator also emits BIL/BIP layout variants for internal
`FormatAdapter` and `CubeStore` read-model validation; the primary smoke and
benchmark baseline remains the BSQ fixture above.

## SDK Usage

The public API remains class-based for the alpha.

```js
import CubeViewer from '@cubescope/web';

const container = document.getElementById('viewer');
const viewer = new CubeViewer(container);

await viewer.init();

await viewer.load({
  kind: 'envi-local',
  headerFile: hdrFile,
  dataFile: imgFile,
});
```

### Compatibility Alias

`loadFile(hdrFile, dataFile)` remains available for compatibility, but
`load(source)` is now the primary interface: `envi-local` for local files and
`envi-http` for remote `HTTP range` sources.

## Runtime Asset Layout For The Published SDK

The alpha package keeps one public browser SDK, plus explicit runtime assets:

- `@cubescope/web`
- `@cubescope/web/worker.js`
- `@cubescope/web/pkg/envi_parser.js`
- `@cubescope/web/pkg/envi_parser_bg.wasm`

When your app serves package assets alongside the ESM entry, the default
constructor works without extra configuration. For bundlers that rewrite asset
URLs, the intended explicit pattern is:

```js
import CubeViewer from '@cubescope/web';
import workerUrl from '@cubescope/web/worker.js?url';
import wasmJsUrl from '@cubescope/web/pkg/envi_parser.js?url';
import wasmWasmUrl from '@cubescope/web/pkg/envi_parser_bg.wasm?url';

const viewer = new CubeViewer(container, {
  workerUrl,
  wasmJsUrl,
  wasmWasmUrl,
});
```

During `0.x`, the package also keeps `EnviViewer` as a compatibility export
alias, but `CubeViewer` is the preferred public name.

## Stable Alpha API

### Constructor

```js
const viewer = new CubeViewer(container, options);
```

`options`:

- `workerUrl?: string`
- `wasmJsUrl?: string`
- `wasmWasmUrl?: string`
- `enableBackgroundStats?: boolean`
- `enableTilePreloading?: boolean`
- `rendererPreference?: 'auto' | 'webgpu' | 'webgl'`

### Methods

- `init(): Promise<void>`
- `load(source): Promise<void>`
- `loadFile(hdrFile, dataFile): Promise<void>` compatibility alias
- `unload(): Promise<void>`
- `setBands({ r, g, b }): void`
- `updateConfig(partialConfig): void`
- `getHeader(): CubeHeader | null`
- `getSpectralProfile(x, y): Promise<Float32Array | null>`
- `getPixelProbe(x, y): Promise<ViewerPixelProbeSnapshot | null>` JSON-safe probe snapshot
- `pixelToWorld(x, y): { x, y } | null`
- `worldToPixel(x, y): { x, y } | null`
- `destroy(): void`

`init()` and `load(source)` reject early initialization or source-load failures
while also emitting `error`. Band selections are validated against the loaded
header; when the preferred `30/20/10` default does not fit a lower-band source,
CubeScope chooses a safe in-range fallback automatically.

When the ENVI header includes `map info` or `coordinate system string`,
`getHeader()` may expose a normalized `spatialReference` with structured
`mapInfo` and a derived `affineTransform`.

### Stable Events

- `ready`
- `loadstart`
- `loadend`
- `header`
- `bandschange`
- `progress`
- `performance`
- `error`
- `image-clicked`

Compatibility aliases retained in the wrapper:

- `headerloaded`
- `bandschanged`

Additional compatibility passthrough events currently emitted by the wrapper,
but not frozen as the minimal alpha contract:

- `metadata`
- `statechange`
- `log`
- `destroyed`

## Binary Data Contract

CubeScope treats large binary payloads as an architecture concern:

- metadata and control messages may use normal object passing
- tiles, spectra, and other large buffers should cross thread boundaries by
  `Transferable` ownership transfer
- `SharedArrayBuffer` is optional and not required for correct alpha behavior

## Repository Commands

```bash
# Rebuild the Rust/WASM runtime
npm run build:wasm

# Build the SDK bundle, worker bundle, and runtime assets
npm run build

# Verify tarball install + import from an isolated consumer app
npm run verify:pack

# Write the consolidated local alpha verification summary
npm run report:alpha

# Run contract and browser smoke tests
npm run test

# Generate the local browser matrix report; Chromium/Firefox/WebKit are validated when installed
npm run report:browser-matrix

# Inspect the local toolchain and discover whether a Node 22 runtime is available
npm run report:toolchain

# Capture the early benchmark metrics used by the software-paper appendix
npm run benchmark

# Generate a preview catalog for a candidate public remote sample
npm run create:sample-catalog -- --id candidate-id --title "Candidate" --header-url "https://example.com/file.hdr" --data-url "https://example.com/file.img" --output public/samples/remote-samples.preview.json

# Qualify a candidate public remote sample before adding it to the shipped catalog
npm run qualify:sample -- --id candidate-id --title "Candidate" --header-url "https://example.com/file.hdr" --data-url "https://example.com/file.img"

# Run the full candidate pipeline: preview catalog + qualification + browser validation
npm run validate:sample-candidate -- --id candidate-id --title "Candidate" --header-url "https://example.com/file.hdr" --data-url "https://example.com/file.img"

# Validate the registered remote-sample catalog against transport + demo load
npm run validate:samples

# Validate the shipped public remote sample and write the public-tier report
CUBESCOPE_SAMPLE_TIER=public CUBESCOPE_SAMPLE_REPORT_PATH=output/samples/public-latest.json npm run validate:samples

# Rerun the alpha verification chain under a detected local Node 22 runtime
npm run verify:node22-local

# Validate a preview catalog without editing the shipped catalog first
CUBESCOPE_SAMPLE_CATALOG_URL=/samples/remote-samples.preview.json CUBESCOPE_REGISTERED_SAMPLE_ID=candidate-id npm run validate:samples

# Run the full local alpha verification chain
npm run verify:alpha
```

## Reproducibility And Documentation

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- API contract: [docs/API.md](docs/API.md)
- Runtime support policy: [docs/RUNTIME_SUPPORT_POLICY.md](docs/RUNTIME_SUPPORT_POLICY.md)
- Software paper draft v1: [docs/SOFTWARE_PAPER_DRAFT_v1.md](docs/SOFTWARE_PAPER_DRAFT_v1.md)
- Chinese translation of the full software paper draft: [docs/SOFTWARE_PAPER_DRAFT_v1_zh-CN.md](docs/SOFTWARE_PAPER_DRAFT_v1_zh-CN.md)
- SoftwareX submission-length manuscript v1: [docs/SOFTWAREX_MANUSCRIPT_v1.md](docs/SOFTWAREX_MANUSCRIPT_v1.md)
- SoftwareX submission-length manuscript v2: [docs/SOFTWAREX_MANUSCRIPT_v2.md](docs/SOFTWAREX_MANUSCRIPT_v2.md)
- SoftwareX submission-length manuscript v3: [docs/SOFTWAREX_MANUSCRIPT_v3.md](docs/SOFTWAREX_MANUSCRIPT_v3.md)
- SoftwareX submission-length manuscript v4: [docs/SOFTWAREX_MANUSCRIPT_v4.md](docs/SOFTWAREX_MANUSCRIPT_v4.md)
- SoftwareX submission package v1: [docs/SOFTWAREX_SUBMISSION_PACKAGE_v1.md](docs/SOFTWAREX_SUBMISSION_PACKAGE_v1.md)
- SoftwareX template input packet v1: [docs/SOFTWAREX_TEMPLATE_INPUT_PACKET_v1.md](docs/SOFTWAREX_TEMPLATE_INPUT_PACKET_v1.md)
- SoftwareX submission fill-in checklist v1: [docs/SOFTWAREX_SUBMISSION_FILL_IN_CHECKLIST_v1.md](docs/SOFTWAREX_SUBMISSION_FILL_IN_CHECKLIST_v1.md)
- SoftwareX cover letter draft v1: [docs/SOFTWAREX_COVER_LETTER_DRAFT_v1.md](docs/SOFTWAREX_COVER_LETTER_DRAFT_v1.md)
- SoftwareX cover letter draft v2: [docs/SOFTWAREX_COVER_LETTER_DRAFT_v2.md](docs/SOFTWAREX_COVER_LETTER_DRAFT_v2.md)
- Blueprint: [docs/CUBESCOPE_BLUEPRINT.md](docs/CUBESCOPE_BLUEPRINT.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)
- Stage report (2026-04-23): [docs/STAGE_REPORT_2026-04-23.md](docs/STAGE_REPORT_2026-04-23.md)
- Documentation review: [docs/DOCUMENTATION_REVIEW.md](docs/DOCUMENTATION_REVIEW.md)
- Next task list: [docs/NEXT_DEVELOPMENT_TASKS.md](docs/NEXT_DEVELOPMENT_TASKS.md)
- Reproducibility steps: [docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md)
- Alpha release checklist: [docs/ALPHA_RELEASE_CHECKLIST.md](docs/ALPHA_RELEASE_CHECKLIST.md)

## Citation

If CubeScope contributes to your work, cite the software release once the alpha
tag is published. The citation metadata lives in [`CITATION.cff`](CITATION.cff).

## License

CubeScope is released under the MIT License. See [LICENSE](LICENSE).
