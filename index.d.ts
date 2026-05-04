export type EnviLocalLoadSource = {
  kind: 'envi-local';
  headerFile: File;
  dataFile: File;
};

export type EnviHttpLoadSource = {
  kind: 'envi-http';
  headerUrl: string;
  dataUrl: string;
  headers?: Record<string, string>;
};

export type ViewerLoadSource = EnviLocalLoadSource | EnviHttpLoadSource;

export type ViewerBands = {
  r: number;
  g: number;
  b: number;
};

export type ViewerRuntimeConfig = {
  backgroundStats?: boolean;
  tilePreloading?: boolean;
};

export type RendererPreference = 'auto' | 'webgpu' | 'webgl';

export type CubeDataType =
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
  | 'u64';

export type CubeBandDisplayRole = 'red' | 'green' | 'blue' | 'nir' | 'gray' | 'other';

export type CubeBandMetadata = {
  index: number;
  name?: string;
  wavelength?: number;
  displayRole?: CubeBandDisplayRole;
};

export type CubeCoordinate = {
  x: number;
  y: number;
};

export type CubeMapInfo = {
  projectionName?: string;
  referencePixel: CubeCoordinate;
  referenceCoordinate: CubeCoordinate;
  pixelSize: CubeCoordinate;
  zone?: number;
  hemisphere?: 'North' | 'South';
  datum?: string;
  units?: string;
  rawTokens?: string[];
};

export type CubeSpatialReference = {
  affineTransform?: [number, number, number, number, number, number];
  epsg?: number;
  coordinateSystemString?: string;
  mapInfo?: CubeMapInfo;
};

export type CubeHeader = {
  samples: number;
  lines: number;
  bands: number;
  interleave: 'bip' | 'bil' | 'bsq';
  dataType: CubeDataType;
  byteOrder: 'lsb' | 'msb';
  headerOffset: number;
  bytesPerPixel: number;
  description?: string;
  fileType?: string;
  sensorType?: string;
  wavelength?: number[];
  customFields?: Record<string, string>;
  bandMetadata?: CubeBandMetadata[];
  spatialReference?: CubeSpatialReference;
};

export type ViewerOptions = {
  workerUrl?: string;
  wasmJsUrl?: string;
  wasmWasmUrl?: string;
  enableBackgroundStats?: boolean;
  enableTilePreloading?: boolean;
  rendererPreference?: RendererPreference;
};

export type ViewerPerformanceMetric = {
  name: 'timeToInitialView' | 'bandSwitchTime';
  value: number;
  unit: string;
};

export type ViewerProgressEvent = {
  type: 'stats_calculation';
  processed: number;
  total: number;
  progress: number;
};

export type ViewerVisibleBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ViewerViewportState = {
  scale: number;
  offsetX: number;
  offsetY: number;
  visibleBounds: ViewerVisibleBounds;
  canvasWidth: number;
  canvasHeight: number;
};

export type ViewerEventMap = {
  ready: void;
  loadstart: void;
  loadend: void;
  header: CubeHeader;
  headerloaded: CubeHeader;
  bandschange: ViewerBands;
  bandschanged: ViewerBands;
  progress: ViewerProgressEvent;
  performance: ViewerPerformanceMetric;
  error: string;
  log: string;
  destroyed: void;
  'image-clicked': { x: number; y: number };
  viewchange: ViewerViewportState | null;
  metadata: Record<string, unknown>;
  statechange: { loading: boolean; message?: string };
};

export declare class CubeViewer {
  constructor(container: HTMLElement, options?: ViewerOptions);
  on<K extends keyof ViewerEventMap>(eventName: K, listener: (payload: ViewerEventMap[K]) => void): void;
  off<K extends keyof ViewerEventMap>(eventName: K, listener: (payload: ViewerEventMap[K]) => void): void;
  init(): Promise<void>;
  load(source: ViewerLoadSource): Promise<void>;
  loadFile(hdrFile: File, dataFile: File): Promise<void>;
  unload(): Promise<void>;
  setBands(bands: ViewerBands): void;
  updateConfig(config?: ViewerRuntimeConfig): void;
  resetView(): void;
  zoomBy(factor: number): void;
  getViewportState(): ViewerViewportState | null;
  getHeader(): CubeHeader | null;
  getSpectralProfile(x: number, y: number): Promise<Float32Array | null>;
  pixelToWorld(x: number, y: number): CubeCoordinate | null;
  worldToPixel(x: number, y: number): CubeCoordinate | null;
  destroy(): void;
}

export { CubeViewer as EnviViewer };
export default CubeViewer;
