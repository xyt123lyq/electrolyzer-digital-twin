const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });

  console.log('Navigating to http://localhost:5180 ...');
  await page.goto('http://localhost:5180', { waitUntil: 'networkidle', timeout: 60000 });
  
  console.log('Page loaded. Waiting for 3D scene initialization...');
  await page.waitForFunction(() => typeof window.__scene__ !== 'undefined');

  console.log('Isolating cathodePlate and positioning camera...');
  await page.evaluate(async () => {
    const scene = window.__scene__;
    scene.stopAutoDemo();
    scene.resetAll();
    
    // Hide all layers except cathodePlate
    scene.cell.children.forEach(child => {
      child.visible = (child.name === 'cathodePlate');
    });
    
    // Position camera close up, looking straight down at the cathode plate face
    scene.camera.position.set(0, 68, 0);
    scene.controls.target.set(0, 0, 0);
    scene.camera.up.set(0, 0, -1); // North is up
    scene.controls.update();
    scene.requestRender();
  });

  console.log('Waiting 1 second for render to complete...');
  await page.waitForTimeout(1000);

  // Trigger render explicitly
  await page.evaluate(() => {
    window.__scene__.requestRender();
  });
  await page.waitForTimeout(500);

  const savePath = path.resolve(__dirname, '../gasket_close.png');
  console.log(`Saving cathode-only close-up screenshot to: ${savePath}`);
  await page.screenshot({ path: savePath, fullPage: false });
  console.log('Screenshot saved successfully.');

  await browser.close();
  console.log('Done.');
})();
