# CubeScope Alpha API

This document describes the actual public browser SDK targeted by
`0.1.0-alpha.1`.

## Main Entry Point

```ts
import CubeViewer from '@cubescope/web'

const viewer = new CubeViewer(container, options)
```

The alpha keeps a class-based API. It does not introduce a factory helper.
`CubeViewer` is now the preferred public class name. `EnviViewer` remains a
compatibility export alias during `0.x`.

## ViewerOptions

```ts
type ViewerOptions = {
  workerUrl?: string
  wasmJsUrl?: string
  wasmWasmUrl?: string
  enableBackgroundStats?: boolean
  enableTilePreloading?: boolean
  rendererPreference?: RendererPreference
}
```

## Core Surface

```ts
type EnviLocalLoadSource = {
  kind: 'envi-local'
  headerFile: File
  dataFile: File
}

type EnviHttpLoadSource = {
  kind: 'envi-http'
  headerUrl: string
  dataUrl: string
  headers?: Record<string, string>
}

type LoadSource = EnviLocalLoadSource | EnviHttpLoadSource

type RGBBands = {
  r: number
  g: number
  b: number
}

type RuntimeConfig = {
  backgroundStats?: boolean
  tilePreloading?: boolean
}

type RendererPreference = 'auto' | 'webgpu' | 'webgl'

// Current alpha behavior:
// - 'auto' prefers WebGPU first
// - after a WebGPU device-loss event, the current viewer session may recover
//   through WebGL instead of repeatedly retrying the lost adapter

type CubeDataType =
  | 'u8'
  | 'i16'
  | 'i32'
  | 'f32'
  | 'f64'
  | 'complex-f32'
  | 'complex-f64'
  | 'u16'
  | 'u32'
  | 'i64'
  | 'u64'

type CubeBandDisplayRole = 'red' | 'green' | 'blue' | 'nir' | 'gray' | 'other'

type CubeBandMetadata = {
  index: number
  name?: string
  wavelength?: number
  displayRole?: CubeBandDisplayRole
}

type CubeCoordinate = {
  x: number
  y: number
}

type CubeMapInfo = {
  projectionName?: string
  referencePixel: CubeCoordinate
  referenceCoordinate: CubeCoordinate
  pixelSize: CubeCoordinate
  zone?: number
  hemisphere?: 'North' | 'South'
  datum?: string
  units?: string
  rawTokens?: string[]
}

type CubeSpatialReference = {
  affineTransform?: [number, number, number, number, number, number]
  epsg?: number
  coordinateSystemString?: string
  mapInfo?: CubeMapInfo
}

type CubeHeader = {
  samples: number
  lines: number
  bands: number
  interleave: 'bip' | 'bil' | 'bsq'
  dataType: CubeDataType
  byteOrder: 'lsb' | 'msb'
  headerOffset: number
  bytesPerPixel: number
  description?: string
  fileType?: string
  sensorType?: string
  wavelength?: number[]
  customFields?: Record<string, string>
  bandMetadata?: CubeBandMetadata[]
  spatialReference?: CubeSpatialReference
}

type ViewerVisibleBounds = {
  x: number
  y: number
  width: number
  height: number
}

type ViewerViewportState = {
  scale: number
  offsetX: number
  offsetY: number
  visibleBounds: ViewerVisibleBounds
  canvasWidth: number
  canvasHeight: number
}

interface CubeViewer {
  init(): Promise<void>
  load(source: LoadSource): Promise<void>
  loadFile(hdrFile: File, dataFile: File): Promise<void>
  unload(): Promise<void>
  destroy(): void

  getHeader(): CubeHeader | null
  setBands(bands: RGBBands): void
  updateConfig(next: RuntimeConfig): void
  resetView(): void
  zoomBy(factor: number): void
  getViewportState(): ViewerViewportState | null
  getSpectralProfile(x: number, y: number): Promise<Float32Array | null>
  pixelToWorld(x: number, y: number): CubeCoordinate | null
  worldToPixel(x: number, y: number): CubeCoordinate | null

  on(eventName: ViewerEventName, handler: ViewerEventHandler): void
  off(eventName: ViewerEventName, handler: ViewerEventHandler): void
}
```

## Header Contract Notes

`getHeader()` now has a stable public shape even though some fields remain
optionally populated in the current alpha. The implementation now normalizes
this object through a single code path before it crosses the public boundary.

Current alpha guarantees for ENVI loads:

1. `samples`, `lines`, `bands`, `interleave`, `headerOffset`, and
   `bytesPerPixel` are expected to be present
2. `dataType` and `byteOrder` are normalized into canonical lower-case tags
   (for example `f32`, `u16`, `lsb`, `msb`) from the Rust/WASM parser output
3. `wavelength` is present only when the source header contains it
4. `spatialReference` is populated when ENVI metadata includes `map info`,
   `coordinate system string`, or explicit affine metadata
5. ENVI `map info` is normalized into a structured `CubeMapInfo`, and
   `affineTransform` is derived from that metadata on the JS side
6. `bandMetadata` remains an additive field and may currently be absent

Spatial boundary note:

1. `pixelToWorld(x, y)` and `worldToPixel(x, y)` operate in zero-based image
   pixel space using the source affine transform when available
2. ENVI `map info` reference pixels are interpreted using the ENVI convention
   represented in the header; common `1, 1, x, y, pixelSizeX, pixelSizeY`
   headers map image pixel `(0, 0)` to the reference world coordinate
3. CubeScope preserves `coordinateSystemString`, datum, zone, hemisphere, and
   units metadata, but does not infer EPSG codes from WKT or projection names
4. assignment-style `map info` tokens such as `units=...` and `rotation=...`
   are preserved in `rawTokens`; rotation is not applied by the current affine
   mapper
5. full CRS transformation, proj4-style conversion, world-space raster warping,
   and map-tile reprojection are intentionally deferred beyond `0.1.0-alpha.1`

Compatibility note:

1. `load({ kind: 'envi-local', headerFile, dataFile })` remains the primary
   zero-install local workflow
2. `load({ kind: 'envi-http', headerUrl, dataUrl, headers? })` now supports
   HTTP range-backed remote ENVI loading through the same viewer contract
3. `loadFile(hdrFile, dataFile)` remains supported throughout the `0.x` series
   as a convenience alias
4. no removal of `loadFile(...)` will happen before `1.0.0`, and any future
   deprecation must be documented at least one minor release in advance

## Failure And Band Semantics

`init()` rejects when the WASM runtime, renderer, or worker pool cannot be
initialized. `load(source)` rejects for invalid sources, source read failures,
header parse failures, and failures to dispatch the initial statistics task.
Both methods still emit the stable `error` event for event-driven integrations.

After a header is parsed, the active RGB band selection is validated against
`header.bands`. CubeScope keeps the preferred `{ r: 30, g: 20, b: 10 }`
selection when it fits the source. For lower-band sources, it automatically
chooses a safe high/mid/low fallback such as `{ r: 16, g: 8, b: 1 }` for a
16-band cube, `{ r: 3, g: 2, b: 1 }` for RGB-like data, and repeated valid
bands for one- or two-band data.

`setBands({ r, g, b })` accepts integer band numbers in the inclusive range
`1..header.bands`. Invalid values emit `error` and throw synchronously.

## Stable Event Set

```ts
type ViewerEventName =
  | 'ready'
  | 'loadstart'
  | 'loadend'
  | 'header'
  | 'bandschange'
  | 'progress'
  | 'performance'
  | 'error'
  | 'image-clicked'
  | 'viewchange'
```

Compatibility aliases still forwarded by the wrapper:

- `headerloaded`
- `bandschanged`

Additional compatibility passthrough events currently exposed by the wrapper,
but not frozen as part of the minimal alpha event contract:

- `metadata`
- `statechange`
- `log`
- `destroyed`

Recommended payload patterns:

- `header` -> `CubeHeader`
- `bandschange` -> `{ r, g, b }`
- `progress` -> `{ type, processed, total, progress }`
- `performance` -> `{ name: 'timeToInitialView' | 'bandSwitchTime', value, unit }`
- `error` -> `string`
- `image-clicked` -> `{ x, y }`
- `viewchange` -> `ViewerViewportState | null`
- `pixelToWorld(...)` / `worldToPixel(...)` -> zero-based image pixel space
  mapped through the source affine transform when available
- `metadata` -> source/file metadata summary
- `statechange` -> `{ loading, message? }`
- `log` -> `string`
- `destroyed` -> no payload

## Binary Data Ownership Rules

For users of the browser SDK, the binary ownership model is part of the
contract:

1. metadata, progress, and errors may use normal object passing
2. large buffers returned by CubeScope may have crossed worker boundaries using
   `Transferable` ownership transfer; callers should treat the receiving side as
   the owner of that buffer
3. `SharedArrayBuffer` remains optional and is not required for correct alpha
   behavior

Internal transport rules, cache ownership, and worker-schema expectations are
defined in `docs/ARCHITECTURE.md`.

## Lifecycle Expectations

The alpha implementation is expected to honor these rules:

1. `load(source)` starts a new source-scoped cache domain and rejects early
   load failures while also emitting `error`
2. `unload()` clears source-scoped caches, broadcasts cancellation for tracked
   worker requests belonging to the active source, and releases renderer-owned
   GPU resources
3. render caches are tied to the active renderer/device and may be dropped on
   context loss or renderer switch
4. stale worker responses from a previous source must not mutate the active
   viewer state
5. switching source acts as an implicit cancel-all for tracked requests from
   the previous source
6. when `rendererPreference` is `auto`, a WebGPU device-loss event may cause
   the current viewer session to recover through WebGL for subsequent draws

## Non-Goals For `0.1.0-alpha.1`

The alpha does not expose:

1. analysis-core or plugin APIs
2. layer management APIs
3. renderer-private resources
4. raw worker pools or cache maps
5. real-time CRS reprojection or proj4-style coordinate transforms
