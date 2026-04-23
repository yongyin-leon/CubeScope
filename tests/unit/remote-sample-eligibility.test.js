import { describe, expect, it } from 'vitest';

import {
    isBrowserRequestAllowed,
    isSameOrigin,
    resolveProbeUrl,
} from '../../src/samples/remote-sample-eligibility.js';

describe('remote sample eligibility', () => {
    it('resolves relative probe URLs against an origin', () => {
        expect(resolveProbeUrl('/fixtures/cube.hdr', 'http://127.0.0.1:4173')).toBe(
            'http://127.0.0.1:4173/fixtures/cube.hdr'
        );
    });

    it('recognizes same-origin sample requests', () => {
        expect(isSameOrigin('http://127.0.0.1:4173/fixtures/cube.hdr', 'http://127.0.0.1:4173')).toBe(true);
        expect(isBrowserRequestAllowed({
            targetUrl: 'http://127.0.0.1:4173/fixtures/cube.hdr',
            origin: 'http://127.0.0.1:4173',
            accessControlAllowOrigin: null,
        })).toBe(true);
    });

    it('requires explicit ACAO for cross-origin sample requests', () => {
        expect(isBrowserRequestAllowed({
            targetUrl: 'https://example.com/cube.hdr',
            origin: 'http://127.0.0.1:4173',
            accessControlAllowOrigin: null,
        })).toBe(false);
        expect(isBrowserRequestAllowed({
            targetUrl: 'https://example.com/cube.hdr',
            origin: 'http://127.0.0.1:4173',
            accessControlAllowOrigin: '*',
        })).toBe(true);
        expect(isBrowserRequestAllowed({
            targetUrl: 'https://example.com/cube.hdr',
            origin: 'http://127.0.0.1:4173',
            accessControlAllowOrigin: 'http://127.0.0.1:4173',
        })).toBe(true);
    });
});
