import { describe, expect, it, vi } from 'vitest';

import {
    WORKER_PROTOCOL_VERSION,
    WorkerResponse,
} from '../../src/protocol/worker-protocol.js';
import { ViewerWorkerPool } from '../../src/runtime/worker-pool.js';

class FakeWorker {
    constructor(handler) {
        this.#handler = handler;
        this.messages = [];
        this.terminated = false;
        this.onmessage = null;
        this.onerror = null;
    }

    #handler;

    postMessage(message) {
        this.messages.push(message);
        this.#handler?.(message, this);
    }

    terminate() {
        this.terminated = true;
    }
}

describe('ViewerWorkerPool', () => {
    it('initializes workers, routes runtime messages, broadcasts, and terminates', async () => {
        const readyWorkers = [];
        const runtimeEvents = [];
        const createdWorkers = [];
        const pool = new ViewerWorkerPool({
            createWorker: (_url, _options) => {
                const worker = new FakeWorker((message, self) => {
                    if (message.type === 'init') {
                        queueMicrotask(() => {
                            self.onmessage?.({
                                data: { protocolVersion: WORKER_PROTOCOL_VERSION, type: WorkerResponse.INIT_COMPLETE, sourceId: 0, payload: {} },
                                target: self,
                            });
                            self.onmessage?.({
                                data: { protocolVersion: WORKER_PROTOCOL_VERSION, type: 'tile_complete', sourceId: 1, payload: { tile: { x: 0, y: 0 }, bands: [30, 20, 10] } },
                                target: self,
                            });
                        });
                    }
                });
                createdWorkers.push(worker);
                return worker;
            },
        });

        const count = await pool.init({
            count: 2,
            workerUrl: '/worker.js',
            wasmJsPath: '/pkg/envi_parser.js',
            wasmWasmPath: '/pkg/envi_parser_bg.wasm',
            onWorkerReady: (worker) => readyWorkers.push(worker),
            onRuntimeMessage: (event) => runtimeEvents.push(event.data.type),
            onWorkerFatalError: () => {},
        });

        expect(count).toBe(2);
        expect(readyWorkers).toHaveLength(2);
        expect(runtimeEvents).toEqual(['tile_complete', 'tile_complete']);

        pool.broadcast({ type: 'cancel', sourceId: 1, payload: { reason: 'test' } });
        expect(createdWorkers.every((worker) => worker.messages.at(-1)?.type === 'cancel')).toBe(true);

        pool.terminateAll();
        expect(createdWorkers.every((worker) => worker.terminated)).toBe(true);
        expect(pool.size()).toBe(0);
    });

    it('rejects initialization when a worker reports an init error', async () => {
        const pool = new ViewerWorkerPool({
            createWorker: () => new FakeWorker((message, self) => {
                if (message.type === 'init') {
                    queueMicrotask(() => {
                        self.onmessage?.({
                            data: {
                                protocolVersion: WORKER_PROTOCOL_VERSION,
                                type: WorkerResponse.ERROR,
                                sourceId: 0,
                                payload: {},
                                error: { message: 'init failed' },
                            },
                            target: self,
                        });
                    });
                }
            }),
        });

        await expect(pool.init({
            count: 1,
            workerUrl: '/worker.js',
            wasmJsPath: '/pkg/envi_parser.js',
            wasmWasmPath: '/pkg/envi_parser_bg.wasm',
            onWorkerReady: () => {},
            onRuntimeMessage: () => {},
            onWorkerFatalError: () => {},
        })).rejects.toThrow('init failed');
    });

    it('rejects initialization messages that do not match the worker protocol', async () => {
        const pool = new ViewerWorkerPool({
            createWorker: () => new FakeWorker((message, self) => {
                if (message.type === 'init') {
                    queueMicrotask(() => {
                        self.onmessage?.({
                            data: { type: WorkerResponse.INIT_COMPLETE, sourceId: 0, payload: {} },
                            target: self,
                        });
                    });
                }
            }),
        });

        await expect(pool.init({
            count: 1,
            workerUrl: '/worker.js',
            wasmJsPath: '/pkg/envi_parser.js',
            wasmWasmPath: '/pkg/envi_parser_bg.wasm',
            onWorkerReady: () => {},
            onRuntimeMessage: () => {},
            onWorkerFatalError: () => {},
        })).rejects.toThrow('Unsupported worker protocol version during initialization');
    });

    it('removes and reports a worker that fails after initialization', async () => {
        const fatalErrors = [];
        const createdWorkers = [];
        const pool = new ViewerWorkerPool({
            createWorker: () => {
                const worker = new FakeWorker((message, self) => {
                    if (message.type === 'init') {
                        queueMicrotask(() => {
                            self.onmessage?.({
                                data: { protocolVersion: WORKER_PROTOCOL_VERSION, type: WorkerResponse.INIT_COMPLETE, sourceId: 0, payload: {} },
                                target: self,
                            });
                        });
                    }
                });
                createdWorkers.push(worker);
                return worker;
            },
        });

        await pool.init({
            count: 1,
            workerUrl: '/worker.js',
            wasmJsPath: '/pkg/envi_parser.js',
            wasmWasmPath: '/pkg/envi_parser_bg.wasm',
            onWorkerReady: () => {},
            onRuntimeMessage: () => {},
            onWorkerFatalError: (error, worker) => fatalErrors.push({ error, worker }),
        });

        createdWorkers[0].onerror?.(new Error('boom'));

        expect(pool.size()).toBe(0);
        expect(createdWorkers[0].terminated).toBe(true);
        expect(fatalErrors).toHaveLength(1);
        expect(fatalErrors[0].worker).toBe(createdWorkers[0]);
        expect(fatalErrors[0].error.message).toBe('boom');
    });
});
