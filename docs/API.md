# CubeScope Alpha API

This document describes the actual public browser SDK targeted by
`0.1.0-alpha.1`.

## Main Entry Point

```ts
import EnviViewer from '@cubescope/web'

const viewer = new EnviViewer(container, options)
```

The alpha keeps a class-based API. It does not introduce a factory helper.

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

interface CubeViewer {
  init(): Promise<void>
  load(source: LoadSource): Promise<void>
  loadFile(hdrFile: File, dataFile: File): Promise<void>
  unload(): Promise<void>
  destroy(): Promise<void>

  getHeader(): Record<string, unknown> | null
  setBands(bands: RGBBands): void
  updateConfig(next: RuntimeConfig): void
  getSpectralProfile(x: number, y: number): Promise<Float32Array | null>

  on(eventName: ViewerEventName, handler: ViewerEventHandler): void
  off(eventName: ViewerEventName, handler: ViewerEventHandler): void
}
```

Compatibility note:

- `load({ kind: 'envi-local', headerFile, dataFile })` is the primary API
- `loadFile(hdrFile, dataFile)` remains as a compatibility alias

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

- `header` -> parsed ENVI header object
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

For large datasets, the binary ownership model is part of the contract:

1. metadata, progress, and errors may use normal object passing
2. tiles, spectra, and other large buffers should cross thread boundaries using
   `Transferable` ownership transfer rather than implicit structured clone
3. `SharedArrayBuffer` remains optional and is not required for correct alpha
   behavior

## Lifecycle Expectations

The alpha implementation is expected to honor these rules:

1. `load(source)` starts a new source-scoped cache domain
2. `unload()` clears source-scoped caches and releases renderer-owned GPU
   resources
3. render caches are tied to the active renderer/device and may be dropped on
   context loss or renderer switch
4. stale worker responses from a previous source must not mutate the active
   viewer state

## Non-Goals For `0.1.0-alpha.1`

The alpha does not expose:

1. HTTP range data sources
2. analysis-core or plugin APIs
3. layer management APIs
4. renderer-private resources
5. raw worker pools or cache maps
