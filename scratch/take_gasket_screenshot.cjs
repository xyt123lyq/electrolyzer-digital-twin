const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });

  // Prefer the current Vite default port, but keep the older fallback for
  // workspaces where Vite has already auto-selected another port.
  const urls = process.env.DEV_SERVER_URL
    ? [process.env.DEV_SERVER_URL]
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5183'];
  let navigated = false;
  for (const url of urls) {
    try {
      console.log(`Navigating to ${url} ...`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      navigated = true;
      break;
    } catch (e) {
      console.warn(`Failed to load ${url}: ${e.message}`);
    }
  }
  if (!navigated) {
    console.error('Unable to reach dev server on any known URL. Exiting.');
    await browser.close();
    process.exit(1);
  }

  // Wait for canvas element to appear (Three.js renders to a canvas)
  await page.waitForSelector('canvas', { timeout: 60000 });
  console.log('Canvas found. Waiting for __scene__...');
  // Wait for the global __scene__ object; give extra time for Vue mount
  await page.waitForFunction(() => typeof window.__scene__ !== 'undefined', { timeout: 120000 });

  console.log('Isolating cathode plate gasket/flow-channel details...');
  await page.evaluate(async () => {
    const scene = window.__scene__;
    if (!scene) return;
    scene.stopAutoDemo?.();
    scene.resetAll?.();

    // The exploded stack's top cover blocks the gasket in a top-down close-up.
    // For inspection, show the cathode plate only: black gasket, flow-channel
    // recess, mesh, bolt holes and lug hole remain visible in one frame.
    scene.cell?.children?.forEach(child => {
      child.visible = child.name === 'cathodePlate';
    });

    if (scene.cellAssembly) {
      scene.cellAssembly.rotation.y = 0;
    }

    // Set camera for top-down view
    scene.camera.position.set(0, 68, 0);
    scene.controls.target.set(0, 0, 0);
    scene.camera.up.set(0, 0, -1);
    scene.controls.update?.();
    scene.requestRender?.();
  });

  console.log('Waiting for render to settle...');
  await page.waitForTimeout(1200);

  // Ensure a final render
  await page.evaluate(() => {
    window.__scene__?.requestRender?.();
  });
  await page.waitForTimeout(500);

  const savePath = path.resolve(__dirname, '../gasket_close.png');
  console.log(`Saving screenshot to ${savePath}`);
  await page.screenshot({ path: savePath, fullPage: false });
  console.log('Screenshot saved.');

  await browser.close();
  console.log('Done.');
})();
