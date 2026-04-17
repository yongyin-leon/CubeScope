import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/smoke',
    fullyParallel: false,
    timeout: 60_000,
    retries: 0,
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL: 'http://127.0.0.1:4173',
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
        command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
        url: 'http://127.0.0.1:4173/examples/',
        reuseExistingServer: true,
        timeout: 120_000,
    },
});
