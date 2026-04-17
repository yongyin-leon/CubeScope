import { expect, test } from '@playwright/test';

import { loadFixtureIntoExample, waitForDemoReady, waitForInitialRender } from '../support/demo-automation.js';

test('loads the synthetic ENVI cube and emits the initial performance metric', async ({ page }) => {
    await page.goto('/examples/');
    await waitForDemoReady(page);
    await loadFixtureIntoExample(page);

    const state = await waitForInitialRender(page);

    expect(state.header).toBeTruthy();
    expect(state.header.bands).toBe(32);
    expect(state.loaded).toBe(true);
    expect(state.metrics.some((metric) => metric.name === 'timeToInitialView')).toBe(true);
    expect(state.errors).toEqual([]);
});
