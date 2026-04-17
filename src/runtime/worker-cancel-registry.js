/**
 * @fileoverview Worker-side cancellation registry for request-scoped suppression.
 */

export function createWorkerCancelRegistry() {
    const canceledRequestsBySource = new Map();

    function getOrCreateRequestSet(sourceId) {
        let requestIds = canceledRequestsBySource.get(sourceId);

        if (!requestIds) {
            requestIds = new Set();
            canceledRequestsBySource.set(sourceId, requestIds);
        }

        return requestIds;
    }

    function cleanupSource(sourceId, requestIds) {
        if (requestIds.size === 0) {
            canceledRequestsBySource.delete(sourceId);
        }
    }

    return {
        cancel(sourceId, requestId) {
            if (!(sourceId > 0) || !requestId) {
                return false;
            }

            getOrCreateRequestSet(sourceId).add(requestId);
            return true;
        },

        isCanceled(sourceId, requestId) {
            return Boolean(requestId)
                && canceledRequestsBySource.get(sourceId)?.has(requestId) === true;
        },

        consume(sourceId, requestId) {
            if (!(sourceId > 0) || !requestId) {
                return false;
            }

            const requestIds = canceledRequestsBySource.get(sourceId);

            if (!requestIds?.delete(requestId)) {
                return false;
            }

            cleanupSource(sourceId, requestIds);
            return true;
        },

        clearSource(sourceId) {
            return canceledRequestsBySource.delete(sourceId);
        },
    };
}
