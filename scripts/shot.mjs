// Dev helper: screenshot a page of the running Vite dev server.
// usage: node scripts/shot.mjs <path> <out.png> [width] [height] [waitMs]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const [, , path = '/', out = 'shot.png', w = '1280', h = '720', wait = '1500'] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:5173${path}`, { waitUntil: 'load' });
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
