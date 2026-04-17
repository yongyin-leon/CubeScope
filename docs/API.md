# CubeScope API Draft

## Design Principles

1. Public API should be small
2. Core methods should be format-agnostic
3. Analysis must be an extension system, not a hard-coded branch
4. Results should be layerable and exportable

## Main Entry Point

```ts
import { createViewer } from '@cubescope/web'

const viewer = await createViewer(container, options)
```

## Viewer Options

```ts
type ViewerOptions = {
  preferredRenderer?: 'webgpu' | 'webgl'
  allowFallback?: boolean
  maxWorkers?: number
  tileSize?: number
  formats?: FormatAdapter[]
  analysis?: AnalysisAlgorithm[]
}
```

## Core Viewer Methods

```ts
interface CubeViewer {
  load(source: LoadSource): Promise<void>
  unload(): Promise<void>
  destroy(): Promise<void>

  getHeader(): CubeHeader | null
  getView(): ViewState
  setView(next: Partial<ViewState>): void

  setBands(bands: RGBBands): Promise<void>
  getBands(): RGBBands

  getSpectrum(x: number, y: number): Promise<SpectrumResult>
  getStats(band: number): Promise<BandStats>

  addLayer(layer: ViewerLayer): string
  updateLayer(id: string, patch: Partial<ViewerLayer>): void
  removeLayer(id: string): void
  listLayers(): ViewerLayer[]

  export(request: ExportRequest): Promise<Blob | ArrayBuffer | object>

  analysis: AnalysisManager

  on(event: ViewerEventName, handler: ViewerEventHandler): Unsubscribe
}
```

## Load Sources

```ts
type LoadSource =
  | { kind: 'envi-local'; headerFile: File; dataFile: File }
  | { kind: 'envi-http'; headerUrl: string; dataUrl: string }
  | { kind: 'adapter'; adapter: string; source: unknown }
```

## Metadata Types

```ts
type CubeHeader = {
  width: number
  height: number
  bands: number
  interleave: 'bip' | 'bil' | 'bsq' | string
  dataType: string
  byteOrder: 'lsb' | 'msb' | string
  wavelengths?: number[]
  metadata?: Record<string, unknown>
}

type RGBBands = {
  r: number
  g: number
  b: number
}

type BandStats = {
  min: number
  max: number
  mean?: number
  std?: number
}

type ViewState = {
  scale: number
  offsetX: number
  offsetY: number
}
```

## Events

```ts
type ViewerEventName =
  | 'ready'
  | 'loadstart'
  | 'loadend'
  | 'header'
  | 'viewchange'
  | 'bandschange'
  | 'progress'
  | 'analysisstart'
  | 'analysisend'
  | 'performance'
  | 'error'
```

Recommended payload patterns:

- `header` -> `CubeHeader`
- `bandschange` -> `RGBBands`
- `progress` -> `{ taskId, stage, completed, total }`
- `performance` -> `{ name, value, unit, context? }`
- `error` -> `{ code, message, cause? }`

## Layer Types

```ts
type ViewerLayer =
  | RGBLayer
  | GrayscaleLayer
  | MaskLayer
  | RasterLayer
  | OverlayLayer

type BaseLayer = {
  id?: string
  name: string
  visible?: boolean
  opacity?: number
}

type RGBLayer = BaseLayer & {
  type: 'rgb'
  bands: RGBBands
}

type GrayscaleLayer = BaseLayer & {
  type: 'grayscale'
  band: number
}

type MaskLayer = BaseLayer & {
  type: 'mask'
  data: Uint8Array | ArrayBuffer
  width: number
  height: number
}

type RasterLayer = BaseLayer & {
  type: 'raster'
  data: Float32Array | Uint8Array | ArrayBuffer
  width: number
  height: number
  colormap?: string
}

type OverlayLayer = BaseLayer & {
  type: 'overlay'
  features: unknown[]
}
```

## Analysis Manager

```ts
interface AnalysisManager {
  list(): AnalysisDescriptor[]
  register(algo: AnalysisAlgorithm<any, any>): void
  unregister(id: string): void
  run<I, O>(id: string, input: I): Promise<AnalysisRunResult<O>>
}
```

## Analysis Contracts

```ts
type AnalysisDescriptor = {
  id: string
  version: string
  label: string
  kind: 'pixel' | 'roi' | 'tile-stream' | 'whole-cube'
  runtime: 'wasm-worker' | 'webgpu' | 'remote'
}

interface AnalysisAlgorithm<I, O> {
  id: string
  version: string
  label: string
  kind: 'pixel' | 'roi' | 'tile-stream' | 'whole-cube'
  runtime: 'wasm-worker' | 'webgpu' | 'remote'
  run(ctx: AnalysisContext, input: I): Promise<O>
}
```

## Analysis Context

```ts
interface AnalysisContext {
  header: CubeHeader
  cube: CubeStore
  signalProgress(progress: {
    stage: string
    completed?: number
    total?: number
  }): void
}
```

## Suggested First-Party Analysis Inputs

```ts
type PixelInput = { x: number; y: number }

type ROIInput = {
  roi:
    | { kind: 'rect'; x: number; y: number; width: number; height: number }
    | { kind: 'polygon'; points: Array<[number, number]> }
}

type BandMathInput = {
  expression: string
  bands: number[]
}

type PCAInput = {
  bands?: number[]
  roi?: ROIInput['roi']
  components: number
}
```

## Analysis Output Model

```ts
type AnalysisRunResult<O> = {
  algorithm: { id: string; version: string }
  startedAt: string
  finishedAt: string
  output: O
  artifacts?: AnalysisArtifact[]
  provenance?: Record<string, unknown>
}

type AnalysisArtifact =
  | { type: 'layer'; layer: ViewerLayer }
  | { type: 'spectrum'; data: SpectrumResult }
  | { type: 'table'; rows: Record<string, unknown>[] }
  | { type: 'blob'; name: string; blob: Blob }
```

## Export Requests

```ts
type ExportRequest =
  | { kind: 'spectrum'; x: number; y: number; format: 'json' | 'csv' }
  | { kind: 'layer'; layerId: string; format: 'png' | 'tiff' | 'json' }
  | { kind: 'analysis'; runId: string; format: 'json' | 'zip' }
```

## Non-Goals For The Public API

The public API should not expose:

1. raw worker lists
2. internal cache maps
3. renderer-private resources
4. demo-specific monitor state
5. ad hoc event names that only one sample app uses

## Compatibility Goal

The public API should be stable enough that:

1. a plain JS app can embed the viewer
2. a React wrapper can sit on top without private hooks
3. analysis plugins can be distributed independently
