/**
 * @fileoverview Request tracking helpers for source-scoped worker lifecycle control.
 */

export function isStaleSourceMessage(activeSourceId, messageSourceId) {
    return Number.isInteger(messageSourceId)
        && messageSourceId > 0
        && messageSourceId !== activeSourceId;
}

export class RequestTracker {
    #requestsBySource = new Map();

    track(sourceId, requestId) {
        if (!(sourceId > 0) || !requestId) {
            return;
        }

        let requestIds = this.#requestsBySource.get(sourceId);

        if (!requestIds) {
            requestIds = new Set();
            this.#requestsBySource.set(sourceId, requestIds);
        }

        requestIds.add(requestId);
    }

    has(sourceId, requestId) {
        return Boolean(requestId)
            && this.#requestsBySource.get(sourceId)?.has(requestId) === true;
    }

    release(sourceId, requestId) {
        if (!(sourceId > 0) || !requestId) {
            return false;
        }

        const requestIds = this.#requestsBySource.get(sourceId);

        if (!requestIds?.delete(requestId)) {
            return false;
        }

        if (requestIds.size === 0) {
            this.#requestsBySource.delete(sourceId);
        }

        return true;
    }

    list(sourceId) {
        return Array.from(this.#requestsBySource.get(sourceId) ?? []);
    }

    invalidateSource(sourceId) {
        const requestIds = this.list(sourceId);
        this.#requestsBySource.delete(sourceId);
        return requestIds;
    }

    clear() {
        this.#requestsBySource.clear();
    }
}
