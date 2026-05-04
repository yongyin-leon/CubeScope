/**
 * @fileoverview ENVI cube byte-reading helpers shared by adapters and workers.
 */

export const DEFAULT_TILE_SIZE = 512;

function assertReader(enviReader) {
    if (!enviReader) {
        throw new TypeError('An initialized EnviReader is required.');
    }
}

function assertDataSource(dataSource) {
    if (!dataSource || typeof dataSource.read !== 'function') {
        throw new TypeError('A byte-addressable dataSource is required.');
    }
}

function assertHeader(header) {
    if (!header?.samples || !header?.lines || !header?.bands || !header?.bytesPerPixel) {
        throw new TypeError('A normalized CubeHeader is required.');
    }
}

function normalizeTile(tile) {
    const x = Number(tile?.x);
    const y = Number(tile?.y);

    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
        throw new TypeError('Tile requests require non-negative integer x and y coordinates.');
    }

    return { x, y };
}

function normalizeTileSize(tileSize) {
    const normalized = Number(tileSize);

    if (!Number.isInteger(normalized) || normalized < 1) {
        throw new TypeError('Tile size must be a positive integer.');
    }

    return normalized;
}

function normalizeOneBasedBands(bands) {
    if (!Array.isArray(bands) || bands.length !== 3) {
        throw new TypeError('Tile rendering requires exactly three one-based RGB bands.');
    }

    return bands.map((band) => {
        const normalized = Number(band);
        if (!Number.isInteger(normalized) || normalized < 1) {
            throw new TypeError('RGB bands must be positive integers.');
        }
        return normalized;
    });
}

export function calculateBsqTileSliceRange(header, bandIndex, tileY, tileSize = DEFAULT_TILE_SIZE) {
    assertHeader(header);
    const normalizedTileSize = normalizeTileSize(tileSize);
    const { samples: imageWidth, lines: imageHeight, bytesPerPixel, headerOffset } = header;
    const bandSize = imageWidth * imageHeight * bytesPerPixel;
    const bandStartOffset = headerOffset + bandIndex * bandSize;
    const bytesPerLine = imageWidth * bytesPerPixel;
    const startLineY = tileY * normalizedTileSize;
    const endLineY = Math.min((tileY + 1) * normalizedTileSize, imageHeight);

    if (startLineY >= imageHeight) {
        return null;
    }

    return {
        start: bandStartOffset + startLineY * bytesPerLine,
        end: bandStartOffset + endLineY * bytesPerLine,
    };
}

export async function readBilTileForBand({
    enviReader,
    dataSource,
    header,
    bandIndex,
    tile,
    tileSize = DEFAULT_TILE_SIZE,
}) {
    assertReader(enviReader);
    assertDataSource(dataSource);
    assertHeader(header);
    const { x: tileX, y: tileY } = normalizeTile(tile);
    const normalizedTileSize = normalizeTileSize(tileSize);
    const { samples: imageWidth, lines: imageHeight, bands, bytesPerPixel, headerOffset } = header;
    const startLine = tileY * normalizedTileSize;

    if (startLine >= imageHeight) {
        return new Float32Array(0);
    }

    const effectiveHeight = Math.min(normalizedTileSize, imageHeight - startLine);
    const bytesPerLinePerBand = imageWidth * bytesPerPixel;
    const bytesPerFullLine = bytesPerLinePerBand * bands;
    const sliceStart = headerOffset + startLine * bytesPerFullLine;
    const sliceEnd = sliceStart + effectiveHeight * bytesPerFullLine;
    const chunkData = new Uint8Array(await dataSource.read({ start: sliceStart, end: sliceEnd }));

    return enviReader.extractBilTileRaw(
        chunkData,
        sliceStart,
        bandIndex,
        tileX,
        tileY,
        normalizedTileSize,
        normalizedTileSize
    );
}

export async function readBipTileForBand({
    enviReader,
    dataSource,
    header,
    bandIndex,
    tile,
    tileSize = DEFAULT_TILE_SIZE,
}) {
    assertReader(enviReader);
    assertDataSource(dataSource);
    assertHeader(header);
    const { x: tileX, y: tileY } = normalizeTile(tile);
    const normalizedTileSize = normalizeTileSize(tileSize);
    const { samples: imageWidth, lines: imageHeight, bands, bytesPerPixel, headerOffset } = header;
    const startLine = tileY * normalizedTileSize;

    if (startLine >= imageHeight) {
        return new Float32Array(0);
    }

    const effectiveHeight = Math.min(normalizedTileSize, imageHeight - startLine);
    const bytesPerFullPixel = bands * bytesPerPixel;
    const bytesPerFullLine = imageWidth * bytesPerFullPixel;
    const sliceStart = headerOffset + startLine * bytesPerFullLine;
    const sliceEnd = sliceStart + effectiveHeight * bytesPerFullLine;
    const chunkData = new Uint8Array(await dataSource.read({ start: sliceStart, end: sliceEnd }));

    return enviReader.extractBipTileRaw(
        chunkData,
        sliceStart,
        bandIndex,
        tileX,
        tileY,
        normalizedTileSize,
        normalizedTileSize
    );
}

export async function readBsqTileForBand({
    enviReader,
    dataSource,
    header,
    bandIndex,
    tile,
    tileSize = DEFAULT_TILE_SIZE,
}) {
    assertReader(enviReader);
    assertDataSource(dataSource);
    assertHeader(header);
    const { x: tileX, y: tileY } = normalizeTile(tile);
    const normalizedTileSize = normalizeTileSize(tileSize);
    const sliceRange = calculateBsqTileSliceRange(header, bandIndex, tileY, normalizedTileSize);

    if (!sliceRange || sliceRange.start >= sliceRange.end) {
        return new Float32Array(0);
    }

    const chunkData = new Uint8Array(await dataSource.read(sliceRange));

    return enviReader.extractBsqTileRaw(
        chunkData,
        sliceRange.start,
        bandIndex,
        tileX,
        tileY,
        normalizedTileSize,
        normalizedTileSize
    );
}

export async function readTileForBand({
    enviReader,
    dataSource,
    header,
    bandIndex,
    tile,
    tileSize = DEFAULT_TILE_SIZE,
}) {
    const interleave = String(header?.interleave ?? '').toLowerCase();
    const request = { enviReader, dataSource, header, bandIndex, tile, tileSize };

    if (interleave === 'bil') {
        return readBilTileForBand(request);
    }
    if (interleave === 'bip') {
        return readBipTileForBand(request);
    }
    if (interleave === 'bsq') {
        return readBsqTileForBand(request);
    }

    throw new Error(`Unsupported interleave format: ${header?.interleave}`);
}

export async function readBipTileChunk({
    dataSource,
    header,
    tile,
    tileSize = DEFAULT_TILE_SIZE,
}) {
    assertDataSource(dataSource);
    assertHeader(header);
    const { y: tileY } = normalizeTile(tile);
    const normalizedTileSize = normalizeTileSize(tileSize);
    const { samples: imageWidth, lines: imageHeight, bands, bytesPerPixel, headerOffset } = header;
    const startLine = tileY * normalizedTileSize;

    if (startLine >= imageHeight) {
        return null;
    }

    const effectiveHeight = Math.min(normalizedTileSize, imageHeight - startLine);
    const bytesPerFullPixel = bands * bytesPerPixel;
    const bytesPerFullLine = imageWidth * bytesPerFullPixel;
    const sliceStart = headerOffset + startLine * bytesPerFullLine;
    const sliceEnd = sliceStart + effectiveHeight * bytesPerFullLine;

    return {
        chunkData: new Uint8Array(await dataSource.read({ start: sliceStart, end: sliceEnd })),
        chunkStartOffset: sliceStart,
    };
}

export async function readRenderedRgbTile({
    enviReader,
    dataSource,
    header,
    tile,
    bands,
    globalStats,
    normalizeBandInPlaceWithStats,
    tileSize = DEFAULT_TILE_SIZE,
}) {
    assertHeader(header);
    if (typeof normalizeBandInPlaceWithStats !== 'function') {
        throw new TypeError('readRenderedRgbTile(...) requires normalizeBandInPlaceWithStats.');
    }

    const normalizedTile = normalizeTile(tile);
    const normalizedTileSize = normalizeTileSize(tileSize);
    const [rBand, gBand, bBand] = normalizeOneBasedBands(bands);
    const [tileR, tileG, tileB] = await Promise.all([
        readTileForBand({
            enviReader,
            dataSource,
            header,
            bandIndex: rBand - 1,
            tile: normalizedTile,
            tileSize: normalizedTileSize,
        }),
        readTileForBand({
            enviReader,
            dataSource,
            header,
            bandIndex: gBand - 1,
            tile: normalizedTile,
            tileSize: normalizedTileSize,
        }),
        readTileForBand({
            enviReader,
            dataSource,
            header,
            bandIndex: bBand - 1,
            tile: normalizedTile,
            tileSize: normalizedTileSize,
        }),
    ]);

    if (
        !tileR
        || tileR.length === 0
        || !globalStats?.[rBand]
        || !globalStats?.[gBand]
        || !globalStats?.[bBand]
    ) {
        return null;
    }

    await Promise.all([
        normalizeBandInPlaceWithStats(tileR, globalStats[rBand].min, globalStats[rBand].max),
        normalizeBandInPlaceWithStats(tileG, globalStats[gBand].min, globalStats[gBand].max),
        normalizeBandInPlaceWithStats(tileB, globalStats[bBand].min, globalStats[bBand].max),
    ]);

    const effectiveWidth = Math.min(normalizedTileSize, header.samples - normalizedTile.x * normalizedTileSize);
    const effectiveHeight = Math.min(normalizedTileSize, header.lines - normalizedTile.y * normalizedTileSize);
    const pixels = new Uint8Array(effectiveWidth * effectiveHeight * 4);

    for (let i = 0; i < tileR.length; i += 1) {
        pixels[i * 4] = Math.round(tileR[i] * 255);
        pixels[i * 4 + 1] = Math.round(tileG[i] * 255);
        pixels[i * 4 + 2] = Math.round(tileB[i] * 255);
        pixels[i * 4 + 3] = 255;
    }

    return {
        pixels,
        effectiveWidth,
        effectiveHeight,
        tile: normalizedTile,
        bands: [rBand, gBand, bBand],
    };
}

export async function readSpectrumAtPixel({
    enviReader,
    dataSource,
    header,
    x,
    y,
    tileSize = DEFAULT_TILE_SIZE,
}) {
    assertReader(enviReader);
    assertDataSource(dataSource);
    assertHeader(header);

    const pixelX = Number(x);
    const pixelY = Number(y);
    const normalizedTileSize = normalizeTileSize(tileSize);

    if (
        !Number.isInteger(pixelX)
        || !Number.isInteger(pixelY)
        || pixelX < 0
        || pixelY < 0
        || pixelX >= header.samples
        || pixelY >= header.lines
    ) {
        throw new RangeError('Spectrum requests require an in-bounds integer pixel coordinate.');
    }

    const tile = {
        x: Math.floor(pixelX / normalizedTileSize),
        y: Math.floor(pixelY / normalizedTileSize),
    };
    const effectiveWidth = Math.min(normalizedTileSize, header.samples - tile.x * normalizedTileSize);
    const effectiveHeight = Math.min(normalizedTileSize, header.lines - tile.y * normalizedTileSize);
    const localX = pixelX - tile.x * normalizedTileSize;
    const localY = pixelY - tile.y * normalizedTileSize;

    if (localX < 0 || localY < 0 || localX >= effectiveWidth || localY >= effectiveHeight) {
        throw new Error('Invalid local pixel index.');
    }

    const index = localY * effectiveWidth + localX;
    const spectrum = new Float32Array(header.bands);

    if (header.interleave === 'bip') {
        const chunkInfo = await readBipTileChunk({
            dataSource,
            header,
            tile,
            tileSize: normalizedTileSize,
        });

        if (!chunkInfo) {
            throw new Error('Failed to read BIP chunk.');
        }

        const requestedBands = Array.from({ length: header.bands }, (_, bandIndex) => bandIndex + 1);
        const extractedBands = enviReader.extractBipTileForBandsRaw(
            chunkInfo.chunkData,
            chunkInfo.chunkStartOffset,
            requestedBands,
            tile.x,
            tile.y,
            normalizedTileSize,
            normalizedTileSize
        );

        for (const bandData of extractedBands) {
            spectrum[bandData.band - 1] = bandData.data && bandData.data.length > index
                ? bandData.data[index]
                : 0;
            bandData.free?.();
        }

        return spectrum;
    }

    for (let bandIndex = 0; bandIndex < header.bands; bandIndex += 1) {
        const tileData = await readTileForBand({
            enviReader,
            dataSource,
            header,
            bandIndex,
            tile,
            tileSize: normalizedTileSize,
        });
        spectrum[bandIndex] = tileData && tileData.length > index ? tileData[index] : 0;
    }

    return spectrum;
}

export async function calculateSampledBandStats({
    enviReader,
    dataSource,
    header,
    bands,
    sampleTiles,
    calculateStatistics,
    tileSize = DEFAULT_TILE_SIZE,
}) {
    assertReader(enviReader);
    assertDataSource(dataSource);
    assertHeader(header);

    if (!Array.isArray(bands)) {
        throw new TypeError('calculateSampledBandStats(...) requires a band list.');
    }
    if (!Array.isArray(sampleTiles)) {
        throw new TypeError('calculateSampledBandStats(...) requires deterministic sample tiles.');
    }
    if (typeof calculateStatistics !== 'function') {
        throw new TypeError('calculateSampledBandStats(...) requires calculateStatistics.');
    }

    const normalizedTileSize = normalizeTileSize(tileSize);
    const bandSamples = new Map(bands.map((band) => [band, []]));
    const samplePromises = sampleTiles.map(async (sampleTile) => {
        try {
            if (header.interleave === 'bip') {
                const chunkInfo = await readBipTileChunk({
                    dataSource,
                    header,
                    tile: sampleTile,
                    tileSize: normalizedTileSize,
                });

                if (!chunkInfo) {
                    return;
                }

                const extractedBands = enviReader.extractBipTileForBandsRaw(
                    chunkInfo.chunkData,
                    chunkInfo.chunkStartOffset,
                    bands,
                    sampleTile.x,
                    sampleTile.y,
                    normalizedTileSize,
                    normalizedTileSize
                );

                for (const bandData of extractedBands) {
                    if (bandSamples.has(bandData.band)) {
                        bandSamples.get(bandData.band).push(bandData.data);
                    }
                    bandData.free?.();
                }
                return;
            }

            await Promise.all(bands.map(async (band) => {
                const tileData = await readTileForBand({
                    enviReader,
                    dataSource,
                    header,
                    bandIndex: band - 1,
                    tile: sampleTile,
                    tileSize: normalizedTileSize,
                });

                if (tileData && tileData.length > 0) {
                    bandSamples.get(band).push(tileData);
                }
            }));
        } catch (error) {
            console.error('[ENVI-IO] Error during sampling:', error);
        }
    });

    await Promise.all(samplePromises);

    const finalStats = {};
    for (const [band, collectedSamples] of bandSamples.entries()) {
        if (collectedSamples.length === 0) {
            finalStats[band] = null;
            continue;
        }

        let globalMin = Infinity;
        let globalMax = -Infinity;
        for (const sampleChunk of collectedSamples) {
            try {
                const chunkStats = calculateStatistics(sampleChunk);
                if (chunkStats.min < globalMin) {
                    globalMin = chunkStats.min;
                }
                if (chunkStats.max > globalMax) {
                    globalMax = chunkStats.max;
                }
                chunkStats.free?.();
            } catch (error) {
                console.error('[ENVI-IO] Error calculating statistics:', error);
            }
        }

        finalStats[band] = { min: globalMin, max: globalMax };
    }

    return finalStats;
}
