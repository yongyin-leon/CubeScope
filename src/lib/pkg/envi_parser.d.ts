/* tslint:disable */
/* eslint-disable */
export function start(): void;
export function set_logging_enabled(enabled: boolean): void;
export function normalizeBandInPlace(data: Float32Array, low_percent: number, high_percent: number): void;
export function normalizeBandInPlaceWithStats(data: Float32Array, min_val: number, max_val: number): void;
/**
 * 从一个f32数据块中高效计算统计数据（均值±2倍标准差）。
 * 这个函数避免了在JS中进行昂贵的排序操作。
 */
export function calculateStatistics(data: Float32Array): BandStats;
export enum ByteOrder {
  Lsb = 0,
  Msb = 1,
}
export enum DataType {
  U8 = 0,
  I16 = 1,
  I32 = 2,
  F32 = 3,
  F64 = 4,
  ComplexF32 = 5,
  ComplexF64 = 6,
  U16 = 7,
  U32 = 8,
  I64 = 9,
  U64 = 10,
}
export enum Interleave {
  Bsq = 0,
  Bil = 1,
  Bip = 2,
}
/**
 * 结构体，用于将统计结果传递给JS
 */
export class BandStats {
  private constructor();
  free(): void;
  min: number;
  max: number;
}
export class EnviReader {
  free(): void;
  constructor(header_content: Uint8Array);
  getHeaderAsJsObject(): any;
  /**
   * 提取并返回指定坐标点的高光谱曲线
   *
   * @param {Uint8Array} chunk_data - 包含目标像素的二进制数据块。
   *     为了保证成功提取，这个数据块理论上需要包含整个文件的数据，
   *     或者至少是经过精心计算的、包含所有波段在该像素位置数据的最小数据范围。
   * @param {number} chunk_start_offset_in_file - 该数据块在完整ENVI文件中的起始偏移量。
   *     如果 chunk_data 是完整文件，则此值为 0。
   * @param {number} x - 目标像素的X坐标 (从0开始)。
   * @param {number} y - 目标像素的Y坐标 (从0开始)。
   * @returns {Float32Array} - 一个包含所有波段值的数组，顺序与头文件一致。
   */
  getSpectralProfile(chunk_data: Uint8Array, chunk_start_offset_in_file: number, x: number, y: number): Float32Array;
  /**
   * [新增] 提取并返回指定坐标点的高光谱曲线，并附带波长信息
   *
   * @param {Uint8Array} chunk_data - 包含目标像素的二进制数据块。
   * @param {number} chunk_start_offset_in_file - 数据块在文件中的起始偏移。
   * @param {number} x - 目标像素的X坐标 (从0开始)。
   * @param {number} y - 目标像素的Y坐标 (从0开始)。
   * @returns {Array<SpectralPoint>} - 一个对象数组，每个对象包含 { wavelength, value }。
   *     如果没有波长信息，wavelength 字段将使用波段号 (从1开始) 代替。
   */
  getSpectralProfileWithWavelengths(chunk_data: Uint8Array, chunk_start_offset_in_file: number, x: number, y: number): any;
  extractRawFromBsqChunk(chunk_data: Uint8Array): Float32Array;
  extractRawRgbFromBipChunk(chunk_data: Uint8Array, r_idx: number, g_idx: number, b_idx: number): object;
  extractRawRgbFromBilChunk(chunk_data: Uint8Array, r_idx: number, g_idx: number, b_idx: number): object;
  extractRawBandFromBipChunk(chunk_data: Uint8Array, band_idx: number): Float32Array;
  extractRawBandFromBilChunk(chunk_data: Uint8Array, band_idx: number): Float32Array;
  extractBilTileRaw(chunk_data: Uint8Array, chunk_start_offset_in_file: number, band_index: number, tile_x_index: number, tile_y_index: number, tile_width: number, tile_height: number): Float32Array;
  extractBsqTileRaw(chunk_data: Uint8Array, chunk_start_offset_in_file: number, band_index: number, tile_x_index: number, tile_y_index: number, tile_width: number, tile_height: number): Float32Array;
  extractBipTileRaw(chunk_data: Uint8Array, chunk_start_offset_in_file: number, band_index: number, tile_x_index: number, tile_y_index: number, tile_width: number, tile_height: number): Float32Array;
  extractBipTileForBandsRaw(chunk_data: Uint8Array, chunk_start_offset_in_file: number, bands_js: any, tile_x_index: number, tile_y_index: number, tile_width: number, tile_height: number): Array<any>;
  readonly samples: number;
  readonly lines: number;
  readonly bands: number;
  readonly header_offset: number;
  readonly bytesPerPixel: number;
  readonly interleave: Interleave;
}
export class ExtractedBand {
  private constructor();
  free(): void;
  /**
   * 波段号 (从 1 开始，与 ENVI 头文件一致)
   */
  band: number;
  /**
   * 该波段的像素数据
   */
  data: Float32Array;
}
/**
 * 用于将单个光谱点（波长和值）传递给JS的结构体
 */
export class SpectralPoint {
  private constructor();
  free(): void;
  wavelength: number;
  value: number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly start: () => void;
  readonly set_logging_enabled: (a: number) => void;
  readonly __wbg_envireader_free: (a: number, b: number) => void;
  readonly __wbg_extractedband_free: (a: number, b: number) => void;
  readonly __wbg_get_extractedband_band: (a: number) => number;
  readonly __wbg_set_extractedband_band: (a: number, b: number) => void;
  readonly __wbg_get_extractedband_data: (a: number) => any;
  readonly __wbg_set_extractedband_data: (a: number, b: any) => void;
  readonly envireader_new: (a: number, b: number) => [number, number, number];
  readonly envireader_samples: (a: number) => number;
  readonly envireader_lines: (a: number) => number;
  readonly envireader_bands: (a: number) => number;
  readonly envireader_header_offset: (a: number) => number;
  readonly envireader_bytesPerPixel: (a: number) => number;
  readonly envireader_interleave: (a: number) => number;
  readonly envireader_getHeaderAsJsObject: (a: number) => [number, number, number];
  readonly envireader_getSpectralProfile: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
  readonly envireader_getSpectralProfileWithWavelengths: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
  readonly envireader_extractRawFromBsqChunk: (a: number, b: number, c: number) => [number, number, number];
  readonly envireader_extractRawRgbFromBipChunk: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
  readonly envireader_extractRawRgbFromBilChunk: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
  readonly envireader_extractRawBandFromBipChunk: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly envireader_extractRawBandFromBilChunk: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly envireader_extractBilTileRaw: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number, number];
  readonly envireader_extractBsqTileRaw: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number, number];
  readonly envireader_extractBipTileRaw: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number, number];
  readonly envireader_extractBipTileForBandsRaw: (a: number, b: number, c: number, d: number, e: any, f: number, g: number, h: number, i: number) => [number, number, number];
  readonly normalizeBandInPlace: (a: number, b: number, c: any, d: number, e: number) => [number, number];
  readonly normalizeBandInPlaceWithStats: (a: number, b: number, c: any, d: number, e: number) => [number, number];
  readonly __wbg_bandstats_free: (a: number, b: number) => void;
  readonly __wbg_get_bandstats_min: (a: number) => number;
  readonly __wbg_set_bandstats_min: (a: number, b: number) => void;
  readonly __wbg_get_bandstats_max: (a: number) => number;
  readonly __wbg_set_bandstats_max: (a: number, b: number) => void;
  readonly calculateStatistics: (a: any) => [number, number, number];
  readonly __wbg_spectralpoint_free: (a: number, b: number) => void;
  readonly __wbg_get_spectralpoint_wavelength: (a: number) => number;
  readonly __wbg_set_spectralpoint_wavelength: (a: number, b: number) => void;
  readonly __wbg_get_spectralpoint_value: (a: number) => number;
  readonly __wbg_set_spectralpoint_value: (a: number, b: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_4: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
