let wasm;

let WASM_VECTOR_LEN = 0;

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_export_4.set(idx, obj);
    return idx;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_export_4.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedFloat32ArrayMemory0 = null;

function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * @param {Float32Array} data
 * @param {number} min_val
 * @param {number} max_val
 */
export function normalizeBandInPlaceWithStats(data, min_val, max_val) {
    var ptr0 = passArrayF32ToWasm0(data, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    const ret = wasm.normalizeBandInPlaceWithStats(ptr0, len0, data, min_val, max_val);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

export function start() {
    wasm.start();
}

/**
 * 从一个f32数据块中高效计算统计数据（均值±2倍标准差）。
 * 这个函数避免了在JS中进行昂贵的排序操作。
 * @param {Float32Array} data
 * @returns {BandStats}
 */
export function calculateStatistics(data) {
    const ret = wasm.calculateStatistics(data);
    if (ret[2]) {
        throw takeFromExternrefTable0(ret[1]);
    }
    return BandStats.__wrap(ret[0]);
}

/**
 * @param {Float32Array} data
 * @param {number} low_percent
 * @param {number} high_percent
 */
export function normalizeBandInPlace(data, low_percent, high_percent) {
    var ptr0 = passArrayF32ToWasm0(data, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    const ret = wasm.normalizeBandInPlace(ptr0, len0, data, low_percent, high_percent);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

/**
 * @param {boolean} enabled
 */
export function set_logging_enabled(enabled) {
    wasm.set_logging_enabled(enabled);
}

/**
 * @enum {0 | 1}
 */
export const ByteOrder = Object.freeze({
    Lsb: 0, "0": "Lsb",
    Msb: 1, "1": "Msb",
});
/**
 * @enum {0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10}
 */
export const DataType = Object.freeze({
    U8: 0, "0": "U8",
    I16: 1, "1": "I16",
    I32: 2, "2": "I32",
    F32: 3, "3": "F32",
    F64: 4, "4": "F64",
    ComplexF32: 5, "5": "ComplexF32",
    ComplexF64: 6, "6": "ComplexF64",
    U16: 7, "7": "U16",
    U32: 8, "8": "U32",
    I64: 9, "9": "I64",
    U64: 10, "10": "U64",
});
/**
 * @enum {0 | 1 | 2}
 */
export const Interleave = Object.freeze({
    Bsq: 0, "0": "Bsq",
    Bil: 1, "1": "Bil",
    Bip: 2, "2": "Bip",
});

const BandStatsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_bandstats_free(ptr >>> 0, 1));
/**
 * 结构体，用于将统计结果传递给JS
 */
export class BandStats {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(BandStats.prototype);
        obj.__wbg_ptr = ptr;
        BandStatsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BandStatsFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_bandstats_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get min() {
        const ret = wasm.__wbg_get_bandstats_min(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set min(arg0) {
        wasm.__wbg_set_bandstats_min(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get max() {
        const ret = wasm.__wbg_get_bandstats_max(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set max(arg0) {
        wasm.__wbg_set_bandstats_max(this.__wbg_ptr, arg0);
    }
}

const EnviReaderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_envireader_free(ptr >>> 0, 1));

export class EnviReader {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        EnviReaderFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_envireader_free(ptr, 0);
    }
    /**
     * @returns {Interleave}
     */
    get interleave() {
        const ret = wasm.envireader_interleave(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get header_offset() {
        const ret = wasm.envireader_header_offset(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get bytesPerPixel() {
        const ret = wasm.envireader_bytesPerPixel(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {Uint8Array} chunk_data
     * @param {number} chunk_start_offset_in_file
     * @param {number} band_index
     * @param {number} tile_x_index
     * @param {number} tile_y_index
     * @param {number} tile_width
     * @param {number} tile_height
     * @returns {Float32Array}
     */
    extractBilTileRaw(chunk_data, chunk_start_offset_in_file, band_index, tile_x_index, tile_y_index, tile_width, tile_height) {
        const ptr0 = passArray8ToWasm0(chunk_data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.envireader_extractBilTileRaw(this.__wbg_ptr, ptr0, len0, chunk_start_offset_in_file, band_index, tile_x_index, tile_y_index, tile_width, tile_height);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {Uint8Array} chunk_data
     * @param {number} chunk_start_offset_in_file
     * @param {number} band_index
     * @param {number} tile_x_index
     * @param {number} tile_y_index
     * @param {number} tile_width
     * @param {number} tile_height
     * @returns {Float32Array}
     */
    extractBipTileRaw(chunk_data, chunk_start_offset_in_file, band_index, tile_x_index, tile_y_index, tile_width, tile_height) {
        const ptr0 = passArray8ToWasm0(chunk_data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.envireader_extractBipTileRaw(this.__wbg_ptr, ptr0, len0, chunk_start_offset_in_file, band_index, tile_x_index, tile_y_index, tile_width, tile_height);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {Uint8Array} chunk_data
     * @param {number} chunk_start_offset_in_file
     * @param {number} band_index
     * @param {number} tile_x_index
     * @param {number} tile_y_index
     * @param {number} tile_width
     * @param {number} tile_height
     * @returns {Float32Array}
     */
    extractBsqTileRaw(chunk_data, chunk_start_offset_in_file, band_index, tile_x_index, tile_y_index, tile_width, tile_height) {
        const ptr0 = passArray8ToWasm0(chunk_data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.envireader_extractBsqTileRaw(this.__wbg_ptr, ptr0, len0, chunk_start_offset_in_file, band_index, tile_x_index, tile_y_index, tile_width, tile_height);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
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
     * @param {Uint8Array} chunk_data
     * @param {number} chunk_start_offset_in_file
     * @param {number} x
     * @param {number} y
     * @returns {Float32Array}
     */
    getSpectralProfile(chunk_data, chunk_start_offset_in_file, x, y) {
        const ptr0 = passArray8ToWasm0(chunk_data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.envireader_getSpectralProfile(this.__wbg_ptr, ptr0, len0, chunk_start_offset_in_file, x, y);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @returns {any}
     */
    getHeaderAsJsObject() {
        const ret = wasm.envireader_getHeaderAsJsObject(this.__wbg_ptr);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {Uint8Array} chunk_data
     * @returns {Float32Array}
     */
    extractRawFromBsqChunk(chunk_data) {
        const ptr0 = passArray8ToWasm0(chunk_data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.envireader_extractRawFromBsqChunk(this.__wbg_ptr, ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {Uint8Array} chunk_data
     * @param {number} chunk_start_offset_in_file
     * @param {any} bands_js
     * @param {number} tile_x_index
     * @param {number} tile_y_index
     * @param {number} tile_width
     * @param {number} tile_height
     * @returns {Array<any>}
     */
    extractBipTileForBandsRaw(chunk_data, chunk_start_offset_in_file, bands_js, tile_x_index, tile_y_index, tile_width, tile_height) {
        const ptr0 = passArray8ToWasm0(chunk_data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.envireader_extractBipTileForBandsRaw(this.__wbg_ptr, ptr0, len0, chunk_start_offset_in_file, bands_js, tile_x_index, tile_y_index, tile_width, tile_height);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {Uint8Array} chunk_data
     * @param {number} r_idx
     * @param {number} g_idx
     * @param {number} b_idx
     * @returns {object}
     */
    extractRawRgbFromBilChunk(chunk_data, r_idx, g_idx, b_idx) {
        const ptr0 = passArray8ToWasm0(chunk_data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.envireader_extractRawRgbFromBilChunk(this.__wbg_ptr, ptr0, len0, r_idx, g_idx, b_idx);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {Uint8Array} chunk_data
     * @param {number} r_idx
     * @param {number} g_idx
     * @param {number} b_idx
     * @returns {object}
     */
    extractRawRgbFromBipChunk(chunk_data, r_idx, g_idx, b_idx) {
        const ptr0 = passArray8ToWasm0(chunk_data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.envireader_extractRawRgbFromBipChunk(this.__wbg_ptr, ptr0, len0, r_idx, g_idx, b_idx);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {Uint8Array} chunk_data
     * @param {number} band_idx
     * @returns {Float32Array}
     */
    extractRawBandFromBilChunk(chunk_data, band_idx) {
        const ptr0 = passArray8ToWasm0(chunk_data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.envireader_extractRawBandFromBilChunk(this.__wbg_ptr, ptr0, len0, band_idx);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {Uint8Array} chunk_data
     * @param {number} band_idx
     * @returns {Float32Array}
     */
    extractRawBandFromBipChunk(chunk_data, band_idx) {
        const ptr0 = passArray8ToWasm0(chunk_data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.envireader_extractRawBandFromBipChunk(this.__wbg_ptr, ptr0, len0, band_idx);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * [新增] 提取并返回指定坐标点的高光谱曲线，并附带波长信息
     *
     * @param {Uint8Array} chunk_data - 包含目标像素的二进制数据块。
     * @param {number} chunk_start_offset_in_file - 数据块在文件中的起始偏移。
     * @param {number} x - 目标像素的X坐标 (从0开始)。
     * @param {number} y - 目标像素的Y坐标 (从0开始)。
     * @returns {Array<SpectralPoint>} - 一个对象数组，每个对象包含 { wavelength, value }。
     *     如果没有波长信息，wavelength 字段将使用波段号 (从1开始) 代替。
     * @param {Uint8Array} chunk_data
     * @param {number} chunk_start_offset_in_file
     * @param {number} x
     * @param {number} y
     * @returns {any}
     */
    getSpectralProfileWithWavelengths(chunk_data, chunk_start_offset_in_file, x, y) {
        const ptr0 = passArray8ToWasm0(chunk_data, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.envireader_getSpectralProfileWithWavelengths(this.__wbg_ptr, ptr0, len0, chunk_start_offset_in_file, x, y);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {Uint8Array} header_content
     */
    constructor(header_content) {
        const ptr0 = passArray8ToWasm0(header_content, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.envireader_new(ptr0, len0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        this.__wbg_ptr = ret[0] >>> 0;
        EnviReaderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    get bands() {
        const ret = wasm.envireader_bands(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get lines() {
        const ret = wasm.envireader_lines(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get samples() {
        const ret = wasm.envireader_samples(this.__wbg_ptr);
        return ret >>> 0;
    }
}

const ExtractedBandFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_extractedband_free(ptr >>> 0, 1));

export class ExtractedBand {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(ExtractedBand.prototype);
        obj.__wbg_ptr = ptr;
        ExtractedBandFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ExtractedBandFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_extractedband_free(ptr, 0);
    }
    /**
     * 波段号 (从 1 开始，与 ENVI 头文件一致)
     * @returns {number}
     */
    get band() {
        const ret = wasm.__wbg_get_extractedband_band(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * 波段号 (从 1 开始，与 ENVI 头文件一致)
     * @param {number} arg0
     */
    set band(arg0) {
        wasm.__wbg_set_extractedband_band(this.__wbg_ptr, arg0);
    }
    /**
     * 该波段的像素数据
     * @returns {Float32Array}
     */
    get data() {
        const ret = wasm.__wbg_get_extractedband_data(this.__wbg_ptr);
        return ret;
    }
    /**
     * 该波段的像素数据
     * @param {Float32Array} arg0
     */
    set data(arg0) {
        wasm.__wbg_set_extractedband_data(this.__wbg_ptr, arg0);
    }
}

const SpectralPointFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_spectralpoint_free(ptr >>> 0, 1));
/**
 * 用于将单个光谱点（波长和值）传递给JS的结构体
 */
export class SpectralPoint {

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SpectralPointFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_spectralpoint_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get wavelength() {
        const ret = wasm.__wbg_get_spectralpoint_wavelength(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set wavelength(arg0) {
        wasm.__wbg_set_spectralpoint_wavelength(this.__wbg_ptr, arg0);
    }
    /**
     * @returns {number}
     */
    get value() {
        const ret = wasm.__wbg_get_spectralpoint_value(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set value(arg0) {
        wasm.__wbg_set_spectralpoint_value(this.__wbg_ptr, arg0);
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbg_String_8f0eb39a4a4c2f66 = function(arg0, arg1) {
        const ret = String(arg1);
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbg_buffer_609cc3eee51ed158 = function(arg0) {
        const ret = arg0.buffer;
        return ret;
    };
    imports.wbg.__wbg_call_672a4d21634d4a24 = function() { return handleError(function (arg0, arg1) {
        const ret = arg0.call(arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_done_769e5ede4b31c67b = function(arg0) {
        const ret = arg0.done;
        return ret;
    };
    imports.wbg.__wbg_extractedband_new = function(arg0) {
        const ret = ExtractedBand.__wrap(arg0);
        return ret;
    };
    imports.wbg.__wbg_get_67b2ba62fc30de12 = function() { return handleError(function (arg0, arg1) {
        const ret = Reflect.get(arg0, arg1);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_get_b9b93047fe3cf45b = function(arg0, arg1) {
        const ret = arg0[arg1 >>> 0];
        return ret;
    };
    imports.wbg.__wbg_instanceof_ArrayBuffer_e14585432e3737fc = function(arg0) {
        let result;
        try {
            result = arg0 instanceof ArrayBuffer;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_instanceof_Uint8Array_17156bcf118086a9 = function(arg0) {
        let result;
        try {
            result = arg0 instanceof Uint8Array;
        } catch (_) {
            result = false;
        }
        const ret = result;
        return ret;
    };
    imports.wbg.__wbg_isArray_a1eab7e0d067391b = function(arg0) {
        const ret = Array.isArray(arg0);
        return ret;
    };
    imports.wbg.__wbg_isSafeInteger_343e2beeeece1bb0 = function(arg0) {
        const ret = Number.isSafeInteger(arg0);
        return ret;
    };
    imports.wbg.__wbg_iterator_9a24c88df860dc65 = function() {
        const ret = Symbol.iterator;
        return ret;
    };
    imports.wbg.__wbg_length_3b4f022188ae8db6 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_length_a446193dc22c12f8 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_length_e2d2a49132c1b256 = function(arg0) {
        const ret = arg0.length;
        return ret;
    };
    imports.wbg.__wbg_log_c222819a41e063d3 = function(arg0) {
        console.log(arg0);
    };
    imports.wbg.__wbg_new_405e22f390576ce2 = function() {
        const ret = new Object();
        return ret;
    };
    imports.wbg.__wbg_new_5e0be73521bc8c17 = function() {
        const ret = new Map();
        return ret;
    };
    imports.wbg.__wbg_new_780abee5c1739fd7 = function(arg0) {
        const ret = new Float32Array(arg0);
        return ret;
    };
    imports.wbg.__wbg_new_78feb108b6472713 = function() {
        const ret = new Array();
        return ret;
    };
    imports.wbg.__wbg_new_a12002a7f91c75be = function(arg0) {
        const ret = new Uint8Array(arg0);
        return ret;
    };
    imports.wbg.__wbg_newwithbyteoffsetandlength_e6b7e69acd4c7354 = function(arg0, arg1, arg2) {
        const ret = new Float32Array(arg0, arg1 >>> 0, arg2 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_newwithlength_5a5efe313cfd59f1 = function(arg0) {
        const ret = new Float32Array(arg0 >>> 0);
        return ret;
    };
    imports.wbg.__wbg_next_25feadfc0913fea9 = function(arg0) {
        const ret = arg0.next;
        return ret;
    };
    imports.wbg.__wbg_next_6574e1a8a62d1055 = function() { return handleError(function (arg0) {
        const ret = arg0.next();
        return ret;
    }, arguments) };
    imports.wbg.__wbg_push_737cfc8c1432c2c6 = function(arg0, arg1) {
        const ret = arg0.push(arg1);
        return ret;
    };
    imports.wbg.__wbg_set_10bad9bee0e9c58b = function(arg0, arg1, arg2) {
        arg0.set(arg1, arg2 >>> 0);
    };
    imports.wbg.__wbg_set_37837023f3d740e8 = function(arg0, arg1, arg2) {
        arg0[arg1 >>> 0] = arg2;
    };
    imports.wbg.__wbg_set_3f1d0b984ed272ed = function(arg0, arg1, arg2) {
        arg0[arg1] = arg2;
    };
    imports.wbg.__wbg_set_65595bdd868b3009 = function(arg0, arg1, arg2) {
        arg0.set(arg1, arg2 >>> 0);
    };
    imports.wbg.__wbg_set_8fc6bf8a5b1071d1 = function(arg0, arg1, arg2) {
        const ret = arg0.set(arg1, arg2);
        return ret;
    };
    imports.wbg.__wbg_set_bb8cecf6a62b9f46 = function() { return handleError(function (arg0, arg1, arg2) {
        const ret = Reflect.set(arg0, arg1, arg2);
        return ret;
    }, arguments) };
    imports.wbg.__wbg_value_cd1ffa7b1ab794f1 = function(arg0) {
        const ret = arg0.value;
        return ret;
    };
    imports.wbg.__wbindgen_as_number = function(arg0) {
        const ret = +arg0;
        return ret;
    };
    imports.wbg.__wbindgen_bigint_from_u64 = function(arg0) {
        const ret = BigInt.asUintN(64, arg0);
        return ret;
    };
    imports.wbg.__wbindgen_boolean_get = function(arg0) {
        const v = arg0;
        const ret = typeof(v) === 'boolean' ? (v ? 1 : 0) : 2;
        return ret;
    };
    imports.wbg.__wbindgen_copy_to_typed_array = function(arg0, arg1, arg2) {
        new Uint8Array(arg2.buffer, arg2.byteOffset, arg2.byteLength).set(getArrayU8FromWasm0(arg0, arg1));
    };
    imports.wbg.__wbindgen_debug_string = function(arg0, arg1) {
        const ret = debugString(arg1);
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_error_new = function(arg0, arg1) {
        const ret = new Error(getStringFromWasm0(arg0, arg1));
        return ret;
    };
    imports.wbg.__wbindgen_init_externref_table = function() {
        const table = wasm.__wbindgen_export_4;
        const offset = table.grow(4);
        table.set(0, undefined);
        table.set(offset + 0, undefined);
        table.set(offset + 1, null);
        table.set(offset + 2, true);
        table.set(offset + 3, false);
        ;
    };
    imports.wbg.__wbindgen_is_function = function(arg0) {
        const ret = typeof(arg0) === 'function';
        return ret;
    };
    imports.wbg.__wbindgen_is_object = function(arg0) {
        const val = arg0;
        const ret = typeof(val) === 'object' && val !== null;
        return ret;
    };
    imports.wbg.__wbindgen_is_string = function(arg0) {
        const ret = typeof(arg0) === 'string';
        return ret;
    };
    imports.wbg.__wbindgen_jsval_loose_eq = function(arg0, arg1) {
        const ret = arg0 == arg1;
        return ret;
    };
    imports.wbg.__wbindgen_memory = function() {
        const ret = wasm.memory;
        return ret;
    };
    imports.wbg.__wbindgen_number_get = function(arg0, arg1) {
        const obj = arg1;
        const ret = typeof(obj) === 'number' ? obj : undefined;
        getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
    };
    imports.wbg.__wbindgen_number_new = function(arg0) {
        const ret = arg0;
        return ret;
    };
    imports.wbg.__wbindgen_string_get = function(arg0, arg1) {
        const obj = arg1;
        const ret = typeof(obj) === 'string' ? obj : undefined;
        var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        var len1 = WASM_VECTOR_LEN;
        getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
        getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    };
    imports.wbg.__wbindgen_string_new = function(arg0, arg1) {
        const ret = getStringFromWasm0(arg0, arg1);
        return ret;
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_init_memory(imports, memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;


    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (typeof module !== 'undefined') {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (typeof module_or_path !== 'undefined') {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (typeof module_or_path === 'undefined') {
        module_or_path = new URL('envi_parser_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync };
export default __wbg_init;
