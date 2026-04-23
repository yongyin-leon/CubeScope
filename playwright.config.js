import { defineConfig } from '@playwright/test';

const webServerPort = process.env.CUBESCOPE_WEBSERVER_PORT ?? '4173';
const baseURL = process.env.CUBESCOPE_BASE_URL ?? `http://127.0.0.1:${webServerPort}`;

export default defineConfig({
    testDir: './tests/smoke',
    fullyParallel: false,
    timeout: 60_000,
    retries: 0,
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL,
        browserName: 'chromium',
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        video: 'off',
        launchOptions: {
            args: [
                '--enable-unsafe-webgpu',
                '--use-angle=swiftshader-webgpu',
            ],
        },
    },
    webServer: {
        command: `npm run dev -- --host 127.0.0.1 --port ${webServerPort} --strictPort`,
        url: `${baseURL}/examples/`,
        reuseExistingServer: true,
        timeout: 120_000,
    },
});
