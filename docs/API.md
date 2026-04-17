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
}
```

## Core Surface

```ts
type LoadSource = {
  kind: 'envi-local'
  headerFile: File
  dataFile: File
}

type RGBBands = {
  r: number
  g: number
  b: number
}

type RuntimeConfig = {
  backgroundStats?: boolean
  tilePreloading?: boolean
}

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

type CubeSpatialReference = {
  affineTransform?: [number, number, number, number, number, number]
  epsg?: number
  coordinateSystemString?: string
  mapInfo?: string | string[] | Record<string, unknown>
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

interface CubeViewer {
  init(): Promise<void>
  load(source: LoadSource): Promise<void>
  loadFile(hdrFile: File, dataFile: File): Promise<void>
  unload(): Promise<void>
  destroy(): Promise<void>

  getHeader(): CubeHeader | null
  setBands(bands: RGBBands): void
  updateConfig(next: RuntimeConfig): void
  getSpectralProfile(x: number, y: number): Promise<Float32Array | null>

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
4. `bandMetadata` and `spatialReference` are reserved additive fields for the
   normalization path and may currently be absent

Compatibility note:

1. `load({ kind: 'envi-local', headerFile, dataFile })` is the primary API
2. `loadFile(hdrFile, dataFile)` remains supported throughout the `0.x` series
   as a convenience alias
3. no removal of `loadFile(...)` will happen before `1.0.0`, and any future
   deprecation must be documented at least one minor release in advance

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

1. `load(source)` starts a new source-scoped cache domain
2. `unload()` clears source-scoped caches, broadcasts cancellation for tracked
   worker requests belonging to the active source, and releases renderer-owned
   GPU resources
3. render caches are tied to the active renderer/device and may be dropped on
   context loss or renderer switch
4. stale worker responses from a previous source must not mutate the active
   viewer state
5. switching source acts as an implicit cancel-all for tracked requests from
   the previous source

## Non-Goals For `0.1.0-alpha.1`

The alpha does not expose:

1. HTTP range data sources
2. analysis-core or plugin APIs
3. layer management APIs
4. renderer-private resources
5. raw worker pools or cache maps
