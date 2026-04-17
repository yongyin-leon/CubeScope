export type EnviLocalLoadSource = {
  kind: 'envi-local';
  headerFile: File;
  dataFile: File;
};

export type ViewerLoadSource = EnviLocalLoadSource;

export type ViewerBands = {
  r: number;
  g: number;
  b: number;
};

export type ViewerRuntimeConfig = {
  backgroundStats?: boolean;
  tilePreloading?: boolean;
};

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

export type CubeSpatialReference = {
  affineTransform?: [number, number, number, number, number, number];
  epsg?: number;
  coordinateSystemString?: string;
  mapInfo?: string | string[] | Record<string, unknown>;
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
  getHeader(): CubeHeader | null;
  getSpectralProfile(x: number, y: number): Promise<Float32Array | null>;
  destroy(): void;
}

export { CubeViewer as EnviViewer };
export default CubeViewer;
