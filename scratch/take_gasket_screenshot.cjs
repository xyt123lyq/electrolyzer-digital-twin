const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });

  // Try primary dev server port, fall back to default Vite port if needed
  const ports = ['5183', '5173'];
  let navigated = false;
  for (const p of ports) {
    try {
      console.log(`Navigating to http://localhost:${p} ...`);
      await page.goto(`http://localhost:${p}`, { waitUntil: 'networkidle', timeout: 60000 });
      navigated = true;
      break;
    } catch (e) {
      console.warn(`Failed to load on port ${p}: ${e.message}`);
    }
  }
  if (!navigated) {
    console.error('Unable to reach dev server on any known port. Exiting.');
    await browser.close();
    process.exit(1);
  }

  // Wait for canvas element to appear (Three.js renders to a canvas)
  await page.waitForSelector('canvas', { timeout: 60000 });
  console.log('Canvas found. Waiting for __scene__...');
  // Wait for the global __scene__ object; give extra time for Vue mount
  await page.waitForFunction(() => typeof window.__scene__ !== 'undefined', { timeout: 120000 });

  console.log('Configuring Three.js camera for close-up top-down view...');
  await page.evaluate(async () => {
    const scene = window.__scene__;
    if (!scene) return;
    scene.stopAutoDemo?.();
    scene.resetAll?.();
    
    // Trigger exploded view if method exists
    scene.triggerExplode?.();
    
    // Set camera for top-down view
    scene.camera.position.set(0, 140, 0);
    scene.controls.target.set(0, 0, 0);
    scene.camera.up.set(0, 0, -1);
    scene.controls.update?.();
    scene.requestRender?.();
  });

  console.log('Waiting 4.5 seconds for explosion animation to settle...');
  await page.waitForTimeout(4500);

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
