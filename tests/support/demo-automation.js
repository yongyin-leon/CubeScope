import { fixtureHdrPath, fixtureImgPath } from './paths.js';

export async function waitForDemoReady(page) {
    await page.waitForFunction(() => window.__cubescopeDemoState?.ready === true);
}

export async function loadFixtureIntoExample(page) {
    await page.setInputFiles('#fileInput', [fixtureHdrPath, fixtureImgPath]);
}

export async function waitForInitialRender(page) {
    await page.waitForFunction(() => {
        const state = window.__cubescopeDemoState;
        return Boolean(
            state?.header
            && state?.loaded
            && state.metrics?.some((metric) => metric.name === 'timeToInitialView')
            && (!state.errors || state.errors.length === 0)
        );
    }, undefined, { timeout: 60_000 });

    return page.evaluate(() => window.__cubescopeDemoState);
}

export async function triggerBandSwitch(page) {
    await page.selectOption('#rBandSelect', '31');
    await page.selectOption('#gBandSelect', '21');
    await page.selectOption('#bBandSelect', '11');
    await page.waitForFunction(() => {
        const state = window.__cubescopeDemoState;
        return state?.metrics?.some((metric) => metric.name === 'bandSwitchTime');
    }, undefined, { timeout: 60_000 });

    return page.evaluate(() => window.__cubescopeDemoState);
}
