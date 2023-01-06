const { spawn } = require('child_process');
const { test, expect, ids, randomPort } = require('./fixtures');

const numSuccesses = 7,
    numPorts = 7;

module.exports = (async () => {
    test.describe(() => {
        test.describe.configure({ retries: 3 });

        test('popup page - that only ONE tab is ever opened', async ({ page, context, serviceWorker }) => {
            const ports = randomPort(numPorts);
            let processes = [];

            test.setTimeout(60000 * numPorts);

            const inputs = {
                port: await page.locator(ids.inputs.port),
                host: await page.locator(ids.inputs.host)
            }
            try {
                for (let port of ports) {
                    const re = new RegExp(`devtools://.*ws=localhost:${port}.*`)
                    processes.push(spawn('node', [`--inspect=${port}`, 'tests/hello.js']));
                    let successes = 0;

                    await page.goto(`chrome-extension://${serviceWorker.url().split('/')[2]}/dist/index.html`);
                    await page.bringToFront();
                    await inputs.port.clear();
                    await inputs.port.type(`${port}`);
                    await inputs.host.press('Enter');
                    for (let loop of Object.keys(Array.from(new Array(numSuccesses)))) {
                        await context.waitForEvent('page');
                        const pages = context.pages().filter(page => page.url().match(re));
                        expect(pages.length).toBe(1);
                        if (loop != numSuccesses - 1) {
                            // leave the last one open for visual help during test debugging
                            await pages[0].close();
                        }
                        successes += 1;
                    }
                    expect(successes).toBe(numSuccesses);
                }
            } finally {
                processes.map(process => process.kill());
                await serviceWorker.evaluate(async () => {
                    await Promise.all([
                        chrome.storage.local.clear(),
                        chrome.storage.session.clear()
                    ]);
                });
            }
        });
    });
})();
