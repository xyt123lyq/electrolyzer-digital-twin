const { chromium } = require('playwright');
const fs = require('fs');

async function capturePort(port) {
  console.log(`Connecting to http://localhost:${port}...`);
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle', timeout: 8000 });
    console.log(`Loaded http://localhost:${port}. Waiting for 3D render...`);
    await page.waitForTimeout(3000);
    
    // Zoom in a bit by scrolling on the canvas
    const canvas = page.locator('canvas').first();
    if (await canvas.count() > 0) {
      const box = await canvas.boundingBox();
      if (box) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        await page.mouse.move(cx, cy);
        for (let i = 0; i < 4; i++) {
          await page.mouse.wheel(0, -120);
          await page.waitForTimeout(50);
        }
      }
    }
    
    const screenshotPath = `c:\\Users\\LYQDZH\\Desktop\\电解水\\三层电解槽\\screenshot_${port}.png`;
    await page.screenshot({ path: screenshotPath });
    console.log(`Successfully saved screenshot to ${screenshotPath}`);
  } catch (err) {
    console.error(`Failed to capture port ${port}:`, err.message);
  } finally {
    if (browser) await browser.close();
  }
}

(async () => {
  // Test both 5173 and 5181
  await capturePort(5173);
  await capturePort(5181);
  console.log('Finished testing.');
})();
