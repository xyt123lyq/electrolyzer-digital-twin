const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log('Navigating to http://localhost:5180 ...');
  await page.goto('http://localhost:5180', { waitUntil: 'networkidle', timeout: 60000 });
  console.log('Page loaded. Waiting 5 seconds for 3D render...');
  await page.waitForTimeout(5000);

  // Target the Three.js canvas specifically
  const threeCanvas = page.locator('canvas[data-engine]');
  const box = await threeCanvas.boundingBox();
  console.log('Three.js canvas box:', JSON.stringify(box));

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  console.log('Scrolling to zoom in at', cx, cy);
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(100);
  }

  console.log('Waiting 1 second...');
  await page.waitForTimeout(1000);

  console.log('Saving screenshot_round5_zoom.png ...');
  await page.screenshot({ path: 'C:\Users\LYQDZH\Desktop\电解水\三层电解槽\screenshot_round5_zoom.png', fullPage: false });
  console.log('Screenshot 1 saved.');

  // Click the explosion button
  console.log('Looking for 爆炸拆解...');
  const btn = page.getByRole('button', { name: '爆炸拆解' });
  if (await btn.count() > 0) {
    await btn.click();
    console.log('Clicked button.');
  } else {
    const el = page.locator('text=爆炸拆解').first();
    await el.click();
    console.log('Clicked text element.');
  }

  console.log('Waiting 3 seconds for animation...');
  await page.waitForTimeout(3000);

  // Zoom in again
  await page.mouse.move(cx, cy);
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(1000);

  console.log('Saving screenshot_round5_zoom_exploded.png ...');
  await page.screenshot({ path: 'C:\Users\LYQDZH\Desktop\电解水\三层电解槽\screenshot_round5_zoom_exploded.png', fullPage: false });
  console.log('Screenshot 2 saved.');

  await browser.close();
  console.log('Done.');
})();
