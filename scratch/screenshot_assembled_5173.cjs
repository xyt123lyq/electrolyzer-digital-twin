const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  console.log('Navigating to http://localhost:5173 ...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 60000 });
  console.log('Page loaded. Waiting for 3D render...');
  await page.waitForTimeout(3000);

  const threeCanvas = page.locator('canvas').first();
  const box = await threeCanvas.boundingBox();

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  
  // Rotate the model to view the lug profile close-up
  console.log('Rotating model to lug profile view...');
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 250, cy + 50, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(1000);

  // Zoom in deeply
  console.log('Zooming in deeply on the lug...');
  for (let i = 0; i < 18; i++) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(2000);

  console.log('Saving screenshot_lug_close.png ...');
  await page.screenshot({ path: 'c:\\Users\\LYQDZH\\Desktop\\电解水\\三层电解槽\\screenshot_lug_close.png' });
  console.log('Screenshot saved.');

  await browser.close();
  console.log('Done.');
})();
