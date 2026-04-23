/**
 * @fileoverview Internal lifecycle controller for source teardown and renderer recovery.
 */

export class ViewerRuntimeLifecycleController {
    #emitLog;
    #emitError;
    #requestAnimationFrameImpl;
    #rendererRecoveryPromise = null;
    #resumeTransitionAfterRendererRecovery = false;

    constructor({
        emitLog = () => {},
        emitError = () => {},
        requestAnimationFrameImpl = (callback) => requestAnimationFrame(callback),
    } = {}) {
        this.#emitLog = emitLog;
        this.#emitError = emitError;
        this.#requestAnimationFrameImpl = requestAnimationFrameImpl;
    }

    async createMetadataSummary({ dataSource, header }) {
        let fileSize = null;

        try {
            fileSize = await dataSource.size();
        } catch {}

        return {
            fileName: dataSource.name,
            fileSize,
            sourceKind: dataSource.kind,
            dimensions: {
                samples: header.samples,
                lines: header.lines,
                bands: header.bands,
            },
            format: {
                interleave: header.interleave.toUpperCase(),
                dataType: header.dataType,
                byteOrder: header.byteOrder.toUpperCase(),
            },
        };
    }

    resetSourceState({
        canceledSourceId = 0,
        cancelReason = 'source-invalidated',
        cancelSourceRequests = () => {},
        resetWorkState = () => {},
        rejectPendingSpectrumRequests = () => {},
        disposeRendererSource = () => {},
        clearMetadataCache = () => {},
        clearStatsCache = () => {},
        clearRequestTracker = () => {},
        unloadCubeStore = () => {},
        resetRuntimePolicy = () => {},
        resetRenderSession = () => {},
        clearRuntimeState = () => {},
    } = {}) {
        cancelSourceRequests(canceledSourceId, cancelReason);
        resetWorkState();
        rejectPendingSpectrumRequests('Viewer source unloaded.');
        disposeRendererSource(canceledSourceId);
        clearMetadataCache(canceledSourceId);
        clearStatsCache(canceledSourceId);
        clearRequestTracker();
        unloadCubeStore();
        clearRuntimeState();
        resetRuntimePolicy();
        resetRenderSession();
    }

    handleRendererLifecycleEvent({
        event,
        resetForRendererRecovery = () => false,
        clearTileRequests = () => {},
        stopPreloading = () => {},
        recoverRenderer = () => undefined,
    }) {
        if (!event) {
            return undefined;
        }

        if (event.type === 'renderer-fallback-armed') {
            this.#emitLog(event.message ?? 'Auto renderer armed a fallback renderer.');
            return undefined;
        }

        if (!event || event.type !== 'device-loss') {
            return undefined;
        }

        const message = event.message ?? 'WebGPU device lost.';
        this.#resumeTransitionAfterRendererRecovery = resetForRendererRecovery();
        this.#emitLog(`Renderer lifecycle event: ${message}`);
        clearTileRequests();
        stopPreloading();
        return recoverRenderer();
    }

    async recoverRendererAfterDeviceLoss({
        renderer,
        hasRenderableSource = () => false,
        startTransition = () => {},
        requestDraw = () => {},
    }) {
        if (!renderer || this.#rendererRecoveryPromise) {
            return this.#rendererRecoveryPromise;
        }

        this.#rendererRecoveryPromise = (async () => {
            try {
                this.#emitLog('Reinitializing renderer after device loss...');
                await renderer.init();
                const initReport = renderer.getLastInitReport?.() ?? null;
                const recoveredKind = initReport?.selectedKind ?? renderer.getKind?.() ?? 'unknown';
                const recoveryMode = initReport?.usedFallback ? ', fallback mode' : '';
                this.#emitLog(`Renderer recovered after device loss (${recoveredKind}${recoveryMode}).`);

                if (this.#resumeTransitionAfterRendererRecovery && hasRenderableSource()) {
                    this.#resumeTransitionAfterRendererRecovery = false;
                    startTransition();
                } else if (hasRenderableSource()) {
                    this.#requestAnimationFrameImpl(() => requestDraw());
                }
            } catch (error) {
                this.#emitError(`Renderer recovery failed: ${error.message}`);
            } finally {
                this.#resumeTransitionAfterRendererRecovery = false;
                this.#rendererRecoveryPromise = null;
            }
        })();

        return this.#rendererRecoveryPromise;
    }
}
