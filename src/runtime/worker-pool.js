/**
 * @fileoverview Internal worker-pool lifecycle manager for runtime workers.
 */

import {
    WORKER_PROTOCOL_VERSION,
    WorkerResponse,
    isSupportedWorkerProtocolVersion,
} from '../protocol/worker-protocol.js';
import { buildWorkerInitRequest } from './worker-dispatch-policy.js';

function toInitErrorMessage(event) {
    return event?.data?.error?.message
        ?? event?.data?.payload?.message
        ?? event?.data?.message
        ?? 'Unknown worker initialization error.';
}

export class ViewerWorkerPool {
    #workers = [];
    #createWorker;

    constructor(options = {}) {
        this.#createWorker = options.createWorker
            ?? ((url, workerOptions) => new Worker(url, workerOptions));
    }

    async init({
        count,
        workerUrl,
        wasmJsPath,
        wasmWasmPath,
        onWorkerReady,
        onRuntimeMessage,
        onWorkerFatalError,
    }) {
        const cacheBustingUrl = `${workerUrl}?t=${Date.now()}`;
        console.log(`Loading Worker from URL (cache-busting): ${cacheBustingUrl}`);
        const initPromises = [];

        for (let i = 0; i < count; i += 1) {
            const worker = this.#createWorker(cacheBustingUrl, { type: 'module' });
            this.#workers.push(worker);
            let initialized = false;
            const promise = new Promise((resolve, reject) => {
                worker.onmessage = (event) => {
                    if (!initialized) {
                        if (!isSupportedWorkerProtocolVersion(event.data)) {
                            this.remove(worker);
                            reject(new Error(`Unsupported worker protocol version during initialization: ${String(event.data?.protocolVersion ?? 'missing')}. Expected ${WORKER_PROTOCOL_VERSION}.`));
                            return;
                        }

                        if (event.data?.type === WorkerResponse.INIT_COMPLETE) {
                            initialized = true;
                            onWorkerReady?.(worker, event);
                            resolve();
                            return;
                        }

                        if (event.data?.type === WorkerResponse.ERROR) {
                            this.remove(worker);
                            reject(new Error(toInitErrorMessage(event)));
                            return;
                        }
                    }

                    onRuntimeMessage?.(event);
                };

                worker.onerror = (error) => {
                    this.remove(worker);
                    onWorkerFatalError?.(error, worker);
                    if (!initialized) {
                        reject(error);
                    }
                };
            });

            worker.postMessage(buildWorkerInitRequest({
                wasmJsPath,
                wasmWasmPath,
            }));
            initPromises.push(promise);
        }

        await Promise.all(initPromises);
        return this.#workers.length;
    }

    remove(worker) {
        const previousCount = this.#workers.length;
        this.#workers = this.#workers.filter((entry) => entry !== worker);
        worker?.terminate?.();
        return previousCount - this.#workers.length;
    }

    broadcast(message) {
        for (const worker of this.#workers) {
            worker.postMessage(message);
        }
    }

    terminateAll() {
        for (const worker of this.#workers) {
            worker.terminate();
        }
        this.#workers = [];
    }

    size() {
        return this.#workers.length;
    }
}
