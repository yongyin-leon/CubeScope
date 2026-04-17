# CubeScope

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
- repository visibility: private until the alpha acceptance gates pass
- package format: ESM-only
- current browser target: WebGPU-capable browsers
- fallback renderer: not part of this alpha

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

## SDK Usage

The public API remains class-based for the alpha.

```js
import CubeViewer from '../src/cube-viewer.js';

const container = document.getElementById('viewer');
const viewer = new CubeViewer(container, {
  workerUrl: '/src/runtime/viewer-worker.js',
});

await viewer.init();

await viewer.load({
  kind: 'envi-local',
  headerFile: hdrFile,
  dataFile: imgFile,
});
```

### Compatibility Alias

`loadFile(hdrFile, dataFile)` remains available for compatibility, but
`load({ kind: 'envi-local', headerFile, dataFile })` is the primary interface.

## Runtime Asset Layout For The Published SDK

The alpha package keeps one public browser SDK, plus explicit runtime assets:

- `@cubescope/web`
- `@cubescope/web/worker.js`
- `@cubescope/web/pkg/envi_parser.js`
- `@cubescope/web/pkg/envi_parser_bg.wasm`

For bundlers that support asset URLs, the intended pattern is:

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

### Methods

- `init(): Promise<void>`
- `load(source): Promise<void>`
- `loadFile(hdrFile, dataFile): Promise<void>` compatibility alias
- `unload(): Promise<void>`
- `setBands({ r, g, b }): void`
- `updateConfig(partialConfig): void`
- `getHeader(): object | null`
- `getSpectralProfile(x, y): Promise<Float32Array | null>`
- `destroy(): void`

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

# Run contract and browser smoke tests
npm run test

# Capture the early benchmark metrics used by the software-paper appendix
npm run benchmark

# Run the full local alpha verification chain
npm run verify:alpha
```

## Reproducibility And Documentation

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- API contract: [docs/API.md](docs/API.md)
- Blueprint: [docs/CUBESCOPE_BLUEPRINT.md](docs/CUBESCOPE_BLUEPRINT.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)
- Documentation review: [docs/DOCUMENTATION_REVIEW.md](docs/DOCUMENTATION_REVIEW.md)
- Next task list: [docs/NEXT_DEVELOPMENT_TASKS.md](docs/NEXT_DEVELOPMENT_TASKS.md)
- Reproducibility steps: [docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md)
- Alpha release checklist: [docs/ALPHA_RELEASE_CHECKLIST.md](docs/ALPHA_RELEASE_CHECKLIST.md)

## Citation

If CubeScope contributes to your work, cite the software release once the alpha
tag is published. The citation metadata lives in [`CITATION.cff`](CITATION.cff).

## License

CubeScope is released under the MIT License. See [LICENSE](LICENSE).
