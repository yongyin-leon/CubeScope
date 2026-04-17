/**
 * @fileoverview
 * EN: This script runs in a Web Worker. It handles all heavy computational tasks like
 * initializing the WebAssembly (Wasm) module, parsing ENVI files, and rendering image tiles.
 * This keeps the main UI thread responsive.
 * 
 * ZH: 该脚本在 Web Worker 中运行。它负责处理所有计算密集型任务，例如初始化
 * WebAssembly (Wasm) 模块、解析 ENVI 文件和渲染图像瓦片，从而保持主 UI 线程的响应能力。
 */

// EN: Wasm functions that will be loaded dynamically.
// ZH: 将被动态加载的 Wasm 函数。
let EnviReader;
let normalizeBandInPlaceWithStats;
let calculateStatistics;

/**
 * EN: Main message handler for the worker. It listens for commands from the main thread.
 * ZH: Worker 的主消息处理器，用于监听来自主线程的命令。
 * @param {MessageEvent} e The event object containing the message data.
 */
self.onmessage = async (e) => {
    const { type, payload } = e.data;

    // EN: Handles the 'init' message. It dynamically imports the Wasm JavaScript bindings,
    //     fetches the Wasm binary, and initializes the module.
    // ZH: 处理 'init' 消息。动态导入 Wasm 的 JavaScript 绑定，获取 Wasm 二进制文件，并初始化模块。
    if (type === 'init') {
        try {
            const wasmModule = await import(payload.wasmJsPath);
            const wasmBinary = await fetch(payload.wasmWasmPath).then(r => r.arrayBuffer());
            await wasmModule.default(wasmBinary);
            
            EnviReader = wasmModule.EnviReader;
            normalizeBandInPlaceWithStats = wasmModule.normalizeBandInPlaceWithStats;
            calculateStatistics = wasmModule.calculateStatistics;

            self.postMessage({ type: 'init_complete' });
        } catch (err) {
            console.error('[Worker] Fatal error during initialization / [Worker] 初始化过程中发生致命错误:', err);
            self.postMessage({ 
                type: 'error', 
                message: `Worker WASM initialization failed / Worker WASM 初始化失败: ${err.message}. Stack: ${err.stack}` 
            });
        }
        return;
    }

    // EN: Ensure the Wasm module is initialized before proceeding.
    // ZH: 确保 Wasm 模块已初始化再继续执行。
    if (!EnviReader) {
        self.postMessage({ type: 'error', message: 'Worker is not yet initialized. / Worker 尚未初始化。' });
        return;
    }
    
    switch (type) {
        // EN: Handles the 'calculate_stats' message. It triggers the calculation of
        //     global statistics (min/max) for specified bands.
        // ZH: 处理 'calculate_stats' 消息。触发对指定波段的全局统计数据（最小值/最大值）的计算。
        case 'calculate_stats': {
            const { hdrBytes, imgFile, bands, header, isInitial } = payload;
            const enviReader = new EnviReader(hdrBytes);
            const stats = await calculateGlobalStats(enviReader, imgFile, bands, header, isInitial);
            self.postMessage({ type: 'stats_complete', payload: { stats, bands, isInitial } });
            break;
        }
        // EN: Handles the 'load_tile' message. It loads the data for a specific tile,
        //     normalizes it, and renders it into an RGBA pixel array.
        // ZH: 处理 'load_tile' 消息。加载特定瓦片的数据，进行归一化处理，并将其渲染为 RGBA 像素阵列。
        case 'load_tile': {
            const { hdrBytes, imgFile, tile, bands, globalStats, header } = payload;
            const enviReader = new EnviReader(hdrBytes);
            try {
                const result = await loadAndRenderTile(enviReader, imgFile, tile, bands, globalStats, header);
                if (result) {
                    // EN: Transfer the pixel buffer back to the main thread to avoid copying.
                    // ZH: 将像素缓冲区传回主线程以避免复制。
                    self.postMessage({ type: 'tile_complete', payload: result }, [result.pixels.buffer]);
                } else {
                    self.postMessage({ type: 'tile_error', payload: { tile } });
                }
            } catch (error) {
                self.postMessage({ type: 'tile_error', payload: { tile, message: error.message } });
            }
            break;
        }
        case 'get_spectrum': {
            const { hdrBytes, imgFile, x, y, header, requestId } = payload;
            const enviReader = new EnviReader(hdrBytes);
            try {
                const TILE_SIZE = 512;
                const tileX = Math.floor(x / TILE_SIZE);
                const tileY = Math.floor(y / TILE_SIZE);
                const effectiveWidth = Math.min(TILE_SIZE, header.samples - tileX * TILE_SIZE);
                const effectiveHeight = Math.min(TILE_SIZE, header.lines - tileY * TILE_SIZE);
                const localX = x - tileX * TILE_SIZE;
                const localY = y - tileY * TILE_SIZE;
                if (localX < 0 || localY < 0 || localX >= effectiveWidth || localY >= effectiveHeight) {
                    throw new Error('Invalid local pixel index');
                }
                const index = localY * effectiveWidth + localX;
                const nB = header.bands;
                let spectrum = new Float32Array(nB);
                const interleave = header.interleave;
                if (interleave === 'bip') {
                    const chunkInfo = await getBipTileChunk(imgFile, header, tileX, tileY);
                    if (!chunkInfo) throw new Error('Failed to read BIP chunk');
                    const bands = Array.from({ length: nB }, (_, i) => i + 1);
                    const extractedBands = enviReader.extractBipTileForBandsRaw(
                        chunkInfo.chunkData,
                        chunkInfo.chunkStartOffset,
                        bands,
                        tileX,
                        tileY,
                        TILE_SIZE,
                        TILE_SIZE
                    );
                    for (const bandData of extractedBands) {
                        spectrum[bandData.band - 1] = bandData.data && bandData.data.length > index ? bandData.data[index] : 0;
                        bandData.free();
                    }
                } else {
                    const getFn = interleave === 'bil' ? getBilTileForBand_Optimized : getBsqTileForBand;
                    for (let b = 0; b < nB; b++) {
                        const tile_data = await getFn(enviReader, imgFile, header, b, tileX, tileY);
                        spectrum[b] = tile_data && tile_data.length > index ? tile_data[index] : 0;
                    }
                }
                self.postMessage({ type: 'spectrum_complete', payload: { requestId, x, y, spectrum: Array.from(spectrum) } });
            } catch (err) {
                self.postMessage({ type: 'spectrum_error', payload: { requestId, message: err.message } });
            }
            break;
        }
    }
};

/**
 * EN: Fetches raw data for the R, G, B bands of a given tile, normalizes each band's data
 *     using global statistics, and then combines them into an RGBA Uint8Array for rendering.
 * ZH: 获取给定瓦片的 R, G, B 波段的原始数据，使用全局统计信息对每个波段的数据进行归一化，
 *     然后将它们合成为一个用于渲染的 RGBA Uint8Array 数组。
 * @returns {Promise<Object|null>} A promise that resolves with the rendered tile data or null on failure.
 */
async function loadAndRenderTile(enviReader, imgFile, tile, bands, globalStats, header) {
    const { x, y } = tile;
    const TILE_SIZE = 512;
    
    if (!bands || !Array.isArray(bands) || bands.length !== 3) {
        console.error('[Worker-ERROR] Invalid bands parameter received in loadAndRenderTile! / loadAndRenderTile收到的bands参数无效!', bands);
        return null;
    }

    const [rBand, gBand, bBand] = bands;
    const rIdx = rBand - 1, gIdx = gBand - 1, bIdx = bBand - 1;
    const interleave = header.interleave;

    let tileR, tileG, tileB;
    let getTileFn;

    // EN: Select the appropriate tile extraction function based on the interleave format.
    // ZH: 根据交错格式选择合适的瓦片提取函数。
    if (interleave === 'bil') getTileFn = getBilTileForBand_Optimized;
    else if (interleave === 'bip') getTileFn = getBipTileForBand_Optimized;
    else if (interleave === 'bsq') getTileFn = getBsqTileForBand;
    else throw new Error(`Unsupported interleave format: ${interleave}`);

    // EN: Fetch data for all three bands in parallel.
    // ZH: 并行获取所有三个波段的数据。
    [tileR, tileG, tileB] = await Promise.all([
        getTileFn(enviReader, imgFile, header, rIdx, x, y),
        getTileFn(enviReader, imgFile, header, gIdx, x, y),
        getTileFn(enviReader, imgFile, header, bIdx, x, y),
    ]);

    if (!tileR || tileR.length === 0 || !globalStats[rBand] || !globalStats[gBand] || !globalStats[bBand]) {
        console.warn(`Tile (${x},${y}) is missing band data or statistics, skipping render. / 瓦片 (${x},${y}) 的波段数据或统计数据不完整，跳过渲染。`);
        return null;
    }
    
    // EN: Normalize each band's data in place to the range [0, 1].
    // ZH: 将每个波段的数据就地归一化到 [0, 1] 范围。
    await Promise.all([
        normalizeBandInPlaceWithStats(tileR, globalStats[rBand].min, globalStats[rBand].max),
        normalizeBandInPlaceWithStats(tileG, globalStats[gBand].min, globalStats[gBand].max),
        normalizeBandInPlaceWithStats(tileB, globalStats[bBand].min, globalStats[bBand].max),
    ]);
    
    const effectiveWidth = Math.min(TILE_SIZE, header.samples - x * TILE_SIZE);
    const effectiveHeight = Math.min(TILE_SIZE, header.lines - y * TILE_SIZE);
    const pixels = new Uint8Array(effectiveWidth * effectiveHeight * 4);
    
    // EN: Combine the normalized R, G, B channels into a single RGBA pixel array.
    // ZH: 将归一化后的 R, G, B 通道合并成一个 RGBA 像素数组。
    for (let i = 0; i < tileR.length; i++) {
        pixels[i*4]   = Math.round(tileR[i] * 255); // R
        pixels[i*4+1] = Math.round(tileG[i] * 255); // G
        pixels[i*4+2] = Math.round(tileB[i] * 255); // B
        pixels[i*4+3] = 255;                         // A
    }
    
    return { pixels, effectiveWidth, effectiveHeight, tile, bands };
}

// --- (EN) Helper functions for reading tile data / (ZH) 读取瓦片数据的辅助函数 ---

/**
 * EN: Calculates the byte slice range for a tile in a BSQ-interleaved file.
 * ZH: 计算 BSQ 交错格式文件中一个瓦片的字节切片范围。
 */
function calculateBsqTileSliceRange(h, bandIndex, tileY, tileSize) {
    const { samples: iW, lines: iH, bytesPerPixel: bpp, headerOffset: hO } = h;
    const bandSize = iW * iH * bpp;
    const bandStartOffset = hO + bandIndex * bandSize;
    const bytesPerLine = iW * bpp;
    const startLineY = tileY * tileSize;
    const endLineY = Math.min((tileY + 1) * tileSize, iH);
    if (startLineY >= iH) return null;
    const sliceStart = bandStartOffset + startLineY * bytesPerLine;
    const sliceEnd = bandStartOffset + endLineY * bytesPerLine;
    return { start: sliceStart, end: sliceEnd };
}

/**
 * EN: Helper function to extract a single band's data for a specific tile from a BIL file.
 * ZH: 辅助函数，用于从 BIL 格式文件中为特定瓦片提取单个波段的数据。
 */
async function getBilTileForBand_Optimized(enviReader, imgFile, header, bandIndex, tileX, tileY) {
    const TILE_SIZE = 512;
    const { samples: iW, lines: iH, bands: nB, bytesPerPixel: bpp, headerOffset: hO } = header;
    const startLine = tileY * TILE_SIZE;
    if (startLine >= iH) return new Float32Array(0);

    const effectiveHeight = Math.min(TILE_SIZE, iH - startLine);
    const bytesPerLinePerBand = iW * bpp;
    const bytesPerFullLine = bytesPerLinePerBand * nB;
    
    const sliceStart = hO + startLine * bytesPerFullLine;
    const sliceEnd = sliceStart + effectiveHeight * bytesPerFullLine;
    
    const chunkBlob = imgFile.slice(sliceStart, sliceEnd);
    const chunkData = new Uint8Array(await chunkBlob.arrayBuffer());

    return enviReader.extractBilTileRaw(chunkData, sliceStart, bandIndex, tileX, tileY, TILE_SIZE, TILE_SIZE);
}

/**
 * EN: Helper function to extract a single band's data for a specific tile from a BIP file.
 * ZH: 辅助函数，用于从 BIP 格式文件中为特定瓦片提取单个波段的数据。
 */
async function getBipTileForBand_Optimized(enviReader, imgFile, header, bandIndex, tileX, tileY) {
    const TILE_SIZE = 512;
    const { samples: iW, lines: iH, bands: nB, bytesPerPixel: bpp, headerOffset: hO } = header;
    const startLine = tileY * TILE_SIZE;
    if (startLine >= iH) return new Float32Array(0);

    const effectiveHeight = Math.min(TILE_SIZE, iH - startLine);
    const bytesPerFullPixel = nB * bpp;
    const bytesPerFullLine = iW * bytesPerFullPixel;
    
    const sliceStart = hO + startLine * bytesPerFullLine;
    const sliceEnd = sliceStart + effectiveHeight * bytesPerFullLine;

    const chunkBlob = imgFile.slice(sliceStart, sliceEnd);
    const chunkData = new Uint8Array(await chunkBlob.arrayBuffer());

    return enviReader.extractBipTileRaw(chunkData, sliceStart, bandIndex, tileX, tileY, TILE_SIZE, TILE_SIZE);
}

/**
 * EN: Helper function to extract a single band's data for a specific tile from a BSQ file.
 * ZH: 辅助函数，用于从 BSQ 格式文件中为特定瓦片提取单个波段的数据。
 */
async function getBsqTileForBand(enviReader, imgFile, header, bandIndex, tileX, tileY) {
    const TILE_SIZE = 512;
    const sliceRange = calculateBsqTileSliceRange(header, bandIndex, tileY, TILE_SIZE);
    if (!sliceRange || sliceRange.start >= sliceRange.end) {
        return new Float32Array(0);
    }
    const chunkBlob = imgFile.slice(sliceRange.start, sliceRange.end);
    const chunkData = new Uint8Array(await chunkBlob.arrayBuffer());
    return enviReader.extractBsqTileRaw(chunkData, sliceRange.start, bandIndex, tileX, tileY, TILE_SIZE, TILE_SIZE);
}

/**
 * EN: Reads a chunk of a BIP file that contains all bands for a specific tile region.
 *     This is an optimization to reduce disk I/O.
 * ZH: 读取 BIP 文件的一个数据块，该数据块包含了特定瓦片区域的所有波段。这是一种减少磁盘 I/O 的优化。
 */
async function getBipTileChunk(imgFile, header, tileX, tileY) {
    const TILE_SIZE = 512;
    const { samples: iW, lines: iH, bands: nB, bytesPerPixel: bpp, headerOffset: hO } = header;
    const startLine = tileY * TILE_SIZE;
    if (startLine >= iH) return null;

    const effectiveHeight = Math.min(TILE_SIZE, iH - startLine);
    const bytesPerFullPixel = nB * bpp;
    const bytesPerFullLine = iW * bytesPerFullPixel;
    
    const sliceStart = hO + startLine * bytesPerFullLine;
    const sliceEnd = sliceStart + effectiveHeight * bytesPerFullLine;

    const chunkBlob = imgFile.slice(sliceStart, sliceEnd);
    return {
        chunkData: new Uint8Array(await chunkBlob.arrayBuffer()),
        chunkStartOffset: sliceStart
    };
}

/**
 * EN: Calculates approximate global statistics (min/max) for a set of bands by sampling
 *     a few random tiles instead of processing the entire file. This is a performance optimization.
 *     For BIP files, it reads a chunk containing all bands at once to minimize disk I/O.
 * ZH: 通过对几个随机瓦片进行采样来计算一组波段的近似全局统计数据（最小值/最大值），而不是处理整个文件。
 *     这是一种性能优化。对于 BIP 文件，它会一次性读取包含所有波段的数据块，以最小化磁盘 I/O。
 * @returns {Promise<Object>} A promise that resolves to an object containing the statistics for each band.
 */
async function calculateGlobalStats(enviReader, imgFile, bands, header, isInitial = false) {
    const TILE_SIZE = 512;
    const finalStats = {};
    // EN: Use fewer samples for the initial, faster calculation.
    // ZH: 初始计算时使用较少的样本以加快速度。
    const sample_count = isInitial ? 2 : 5;
    const interleave = header.interleave;

    // EN: Initialize a sample collector for each required band.
    // ZH: 为每个需要的波段初始化一个样本收集器。
    const bandSamples = new Map(bands.map(b => [b, []]));

    const samplePromises = [];
    for (let i = 0; i < sample_count; i++) {
        const randTileX = Math.floor(Math.random() * (header.samples / TILE_SIZE));
        const randTileY = Math.floor(Math.random() * (header.lines / TILE_SIZE));

        samplePromises.push((async () => {
            try {
                // EN: For BIP format, use a new batch extraction strategy to reduce I/O.
                // ZH: 对于 BIP 格式，使用新的批量提取策略以减少 I/O。
                if (interleave === 'bip') {
                    // 1. EN: Read the raw data block containing all bands (one disk read).
                    //    ZH: 读取包含所有波段的原始数据块（一次磁盘读取）。
                    const chunkInfo = await getBipTileChunk(imgFile, header, randTileX, randTileY);
                    if (!chunkInfo) return;
                    
                    // 2. EN: Call Wasm to extract all required band samples at once.
                    //    ZH: 调用 WASM 一次性提取所有需要的波段样本。
                    const extractedBands = enviReader.extractBipTileForBandsRaw(
                        chunkInfo.chunkData, 
                        chunkInfo.chunkStartOffset,
                        bands, // Pass JS array directly
                        randTileX, 
                        randTileY, 
                        TILE_SIZE, 
                        TILE_SIZE
                    );
                    
                    // 3. EN: Store the extracted samples in their respective collectors.
                    //    ZH: 将提取出的样本存入各自的收集中。
                    for (const bandData of extractedBands) {
                        if (bandSamples.has(bandData.band)) {
                            bandSamples.get(bandData.band).push(bandData.data);
                        }
                        // EN: Free the memory allocated by Wasm for this band's data.
                        // ZH: 释放 Wasm 为该波段数据分配的内存。
                        bandData.free(); 
                    }

                } else { // EN: For BSQ/BIL, the existing logic is efficient enough.
                         // ZH: 对于 BSQ/BIL，原有逻辑已经很高效。
                    await Promise.all(bands.map(async (band) => {
                        let tile_data;
                        const bandIndex = band - 1;
                        if (interleave === 'bil') tile_data = await getBilTileForBand_Optimized(enviReader, imgFile, header, bandIndex, randTileX, randTileY);
                        else if (interleave === 'bsq') tile_data = await getBsqTileForBand(enviReader, imgFile, header, bandIndex, randTileX, randTileY);
                        
                        if (tile_data && tile_data.length > 0) {
                            bandSamples.get(band).push(tile_data);
                        }
                    }));
                }
            } catch (e) {
                console.error(`[Worker-ERROR] Error during sampling / 采样时发生错误:`, e);
            }
        })());
    }
    await Promise.all(samplePromises);

    // EN: Calculate statistics from the collected samples.
    // ZH: 从收集到的样本中计算统计数据。
    for (const [band, collectedSamples] of bandSamples.entries()) {
        if (collectedSamples.length > 0) {
            let globalMin = Infinity, globalMax = -Infinity;
            for (const sampleChunk of collectedSamples) {
                try {
                    // EN: Use Wasm to calculate min and max for the chunk.
                    // ZH: 使用 Wasm 计算数据块的最小值和最大值。
                    const chunkStats = calculateStatistics(sampleChunk);
                    if (chunkStats.min < globalMin) globalMin = chunkStats.min;
                    if (chunkStats.max > globalMax) globalMax = chunkStats.max;
                    // EN: Free the memory allocated by Wasm for the stats object.
                    // ZH: 释放 Wasm 为统计对象分配的内存。
                    chunkStats.free();
                } catch(e) {
                    console.error("[Worker-ERROR] Error calculating statistics / 计算统计数据时出错:", e);
                }
            }
            finalStats[band] = { min: globalMin, max: globalMax };
        } else {
            console.warn(`[Worker-WARN] No valid data was collected for band ${band} to calculate statistics. / 波段 ${band} 未能采集到任何有效数据进行统计。`);
            finalStats[band] = null;
        }
    }
    
    return finalStats;
}