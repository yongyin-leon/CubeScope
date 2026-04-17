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
  header: Record<string, unknown>;
  headerloaded: Record<string, unknown>;
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

export default class EnviViewer {
  constructor(container: HTMLElement, options?: ViewerOptions);
  on<K extends keyof ViewerEventMap>(eventName: K, listener: (payload: ViewerEventMap[K]) => void): void;
  off<K extends keyof ViewerEventMap>(eventName: K, listener: (payload: ViewerEventMap[K]) => void): void;
  init(): Promise<void>;
  load(source: ViewerLoadSource): Promise<void>;
  loadFile(hdrFile: File, dataFile: File): Promise<void>;
  unload(): Promise<void>;
  setBands(bands: ViewerBands): void;
  updateConfig(config?: ViewerRuntimeConfig): void;
  getHeader(): Record<string, unknown> | null;
  getSpectralProfile(x: number, y: number): Promise<Float32Array | null>;
  destroy(): void;
}
