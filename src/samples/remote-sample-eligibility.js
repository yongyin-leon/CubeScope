/**
 * @fileoverview Browser fetch eligibility helpers for remote sample validation.
 */

export function resolveProbeUrl(rawUrl, origin) {
    return new URL(rawUrl, origin).toString();
}

export function isSameOrigin(targetUrl, origin) {
    return new URL(targetUrl).origin === new URL(origin).origin;
}

export function isBrowserRequestAllowed({ targetUrl, origin, accessControlAllowOrigin }) {
    if (isSameOrigin(targetUrl, origin)) {
        return true;
    }

    if (!accessControlAllowOrigin) {
        return false;
    }

    return accessControlAllowOrigin === '*' || accessControlAllowOrigin === origin;
}
