import { describe, expect, it } from 'vitest';

import { buildExampleUrl } from '../support/demo-automation.js';

describe('demo automation helpers', () => {
    it('builds the default example URL without an explicit catalog parameter', () => {
        expect(buildExampleUrl()).toBe('/examples/');
        expect(buildExampleUrl({ benchmark: true })).toBe('/examples/?benchmark=1');
    });

    it('builds a benchmark URL with a sample id and custom catalog override', () => {
        expect(buildExampleUrl({
            benchmark: true,
            sampleId: 'candidate-id',
            catalogUrl: '/samples/remote-samples.preview.json',
        })).toBe('/examples/?benchmark=1&sample=candidate-id&catalog=%2Fsamples%2Fremote-samples.preview.json');
    });

    it('includes an explicit renderer preference when requested', () => {
        expect(buildExampleUrl({
            benchmark: true,
            renderer: 'webgl',
        })).toBe('/examples/?benchmark=1&renderer=webgl');
    });
});
