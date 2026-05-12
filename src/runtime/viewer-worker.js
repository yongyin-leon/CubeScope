/**
 * @fileoverview Worker protocol executor for CubeScope runtime work.
 */

import {
    WORKER_PROTOCOL_VERSION,
    WorkerCommand,
    WorkerResponse,
    createWorkerError,
    createWorkerResponse,
    isSupportedWorkerProtocolVersion,
} from '../protocol/worker-protocol.js';
import { buildDeterministicSampleTiles } from './tile-sampling.js';
import { createWorkerCubeStore } from './worker-cube-store.js';
import { createWorkerCancelRegistry } from './worker-cancel-registry.js';

let wasmModule;
const cancelRegistry = createWorkerCancelRegistry();
let activeRequest = null;

function setActiveRequest(sourceId, requestId) {
    if (!(sourceId > 0) || !requestId) {
        activeRequest = null;
        return;
    }

    activeRequest = { sourceId, requestId };
}

function clearActiveRequest() {
    activeRequest = null;
}

function isActiveRequest(sourceId, requestId) {
    return activeRequest?.sourceId === sourceId
        && activeRequest?.requestId === requestId;
}

self.onmessage = async (event) => {
    const data = event.data ?? {};
    if (!isSupportedWorkerProtocolVersion(data)) {
        self.postMessage(createWorkerError({
            sourceId: Number.isInteger(data.sourceId) ? data.sourceId : 0,
            requestId: data.requestId,
            message: `Unsupported worker protocol version: ${String(data.protocolVersion ?? 'missing')}. Expected ${WORKER_PROTOCOL_VERSION}.`,
        }));
        return;
    }

    const {
        type,
        sourceId = 0,
        requestId,
        payload = {},
    } = data;

    if (type === WorkerCommand.INIT) {
        try {
            wasmModule = await import(/* @vite-ignore */ payload.wasmJsPath);
            const wasmBinary = await fetch(payload.wasmWasmPath).then((response) => response.arrayBuffer());
            await wasmModule.default({ module_or_path: wasmBinary });

            self.postMessage(createWorkerResponse(WorkerResponse.INIT_COMPLETE, {
                sourceId,
                requestId,
            }));
        } catch (error) {
            console.error('[Worker] Fatal error during initialization:', error);
            self.postMessage(createWorkerError({
                sourceId,
                requestId,
                message: `Worker WASM initialization failed: ${error.message}. Stack: ${error.stack}`,
            }));
        }
        return;
    }

    if (type === WorkerCommand.CANCEL) {
        if (isActiveRequest(sourceId, requestId)) {
            cancelRegistry.cancel(sourceId, requestId);
        }
        return;
    }

    if (!wasmModule?.EnviReader) {
        self.postMessage(createWorkerError({
            sourceId,
            requestId,
            message: 'Worker is not yet initialized.',
        }));
        return;
    }

    switch (type) {
    case WorkerCommand.CALCULATE_STATS: {
        const { hdrBytes, dataSource: dataSourceDescriptor, bands, header, isInitial } = payload;
        setActiveRequest(sourceId, requestId);
        try {
            if (cancelRegistry.consume(sourceId, requestId)) {
                self.postMessage(createWorkerResponse(WorkerResponse.CANCELED, { sourceId, requestId }));
                break;
            }

            const store = createWorkerCubeStore({
                sourceId,
                hdrBytes,
                dataSource: dataSourceDescriptor,
                header,
                wasmModule,
            });
            const stats = await store.calculateStats({
                bands,
                sampleTiles: buildDeterministicSampleTiles(header, {
                    sampleCount: isInitial ? 2 : 5,
                }),
            });

            if (cancelRegistry.consume(sourceId, requestId)) {
                self.postMessage(createWorkerResponse(WorkerResponse.CANCELED, { sourceId, requestId }));
                break;
            }

            self.postMessage(createWorkerResponse(WorkerResponse.STATS_COMPLETE, {
                sourceId,
                requestId,
                payload: { stats, bands, isInitial },
            }));
        } catch (error) {
            self.postMessage(createWorkerError({
                sourceId,
                requestId,
                message: error.message,
                payload: { bands, isInitial },
            }));
        } finally {
            clearActiveRequest();
        }
        break;
    }

    case WorkerCommand.LOAD_TILE: {
        const { hdrBytes, dataSource: dataSourceDescriptor, tile, bands, globalStats, header } = payload;
        setActiveRequest(sourceId, requestId);
        try {
            if (cancelRegistry.consume(sourceId, requestId)) {
                self.postMessage(createWorkerResponse(WorkerResponse.CANCELED, { sourceId, requestId }));
                break;
            }

            const store = createWorkerCubeStore({
                sourceId,
                hdrBytes,
                dataSource: dataSourceDescriptor,
                header,
                wasmModule,
            });
            const result = await store.getTile({ tile, bands, globalStats });

            if (cancelRegistry.consume(sourceId, requestId)) {
                self.postMessage(createWorkerResponse(WorkerResponse.CANCELED, { sourceId, requestId }));
                break;
            }

            if (result) {
                self.postMessage(createWorkerResponse(WorkerResponse.TILE_COMPLETE, {
                    sourceId,
                    requestId,
                    payload: result,
                }), [result.pixels.buffer]);
            } else {
                self.postMessage(createWorkerResponse(WorkerResponse.TILE_ERROR, {
                    sourceId,
                    requestId,
                    payload: { tile },
                }));
            }
        } catch (error) {
            self.postMessage(createWorkerResponse(WorkerResponse.TILE_ERROR, {
                sourceId,
                requestId,
                payload: {
                    tile,
                    message: error.message,
                },
            }));
        } finally {
            clearActiveRequest();
        }
        break;
    }

    case WorkerCommand.GET_SPECTRUM: {
        const { hdrBytes, dataSource: dataSourceDescriptor, x, y, header } = payload;
        setActiveRequest(sourceId, requestId);
        try {
            if (cancelRegistry.consume(sourceId, requestId)) {
                self.postMessage(createWorkerResponse(WorkerResponse.CANCELED, { sourceId, requestId }));
                break;
            }

            const store = createWorkerCubeStore({
                sourceId,
                hdrBytes,
                dataSource: dataSourceDescriptor,
                header,
                wasmModule,
            });
            const spectrum = await store.getSpectrum({ x, y });

            if (cancelRegistry.consume(sourceId, requestId)) {
                self.postMessage(createWorkerResponse(WorkerResponse.CANCELED, { sourceId, requestId }));
                break;
            }

            self.postMessage(createWorkerResponse(WorkerResponse.SPECTRUM_COMPLETE, {
                sourceId,
                requestId,
                payload: {
                    x,
                    y,
                    spectrum: Array.from(spectrum),
                },
            }));
        } catch (error) {
            self.postMessage(createWorkerResponse(WorkerResponse.SPECTRUM_ERROR, {
                sourceId,
                requestId,
                payload: {
                    message: error.message,
                },
            }));
        } finally {
            clearActiveRequest();
        }
        break;
    }

    default:
        self.postMessage(createWorkerError({
            sourceId,
            requestId,
            message: `Unsupported worker command: ${type}`,
        }));
    }
};
