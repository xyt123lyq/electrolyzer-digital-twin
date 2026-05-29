const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 60000 });
  console.log('Page loaded. Waiting 3 seconds for 3D render...');
  await page.waitForTimeout(3000);

  // Click the explosion button
  console.log('Clicking 爆炸拆解 button...');
  const btn = page.getByRole('button', { name: '爆炸拆解' });
  if (await btn.count() > 0) {
    await btn.click();
  } else {
    const el = page.locator('text=爆炸拆解').first();
    await el.click();
  }
  
  console.log('Waiting 5 seconds for explosion animation and flow visualizers to animate...');
  await page.waitForTimeout(5000);

  // Target the Three.js canvas specifically
  const threeCanvas = page.locator('canvas').first();
  const box = await threeCanvas.boundingBox();
  console.log('Three.js canvas box:', JSON.stringify(box));

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  
  // Rotate the model to get a better perspective of the gasket surface
  console.log('Rotating model to view gasket...');
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 300, cy - 100, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(1000);

  // Zoom in
  console.log('Zooming in...');
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(2000);

  console.log('Saving screenshot_exploded_5173.png ...');
  await page.screenshot({ path: 'c:\\Users\\LYQDZH\\Desktop\\电解水\\三层电解槽\\screenshot_exploded_5173.png', fullPage: false });
  console.log('Screenshot saved successfully.');

  await browser.close();
  console.log('Done.');
})();
