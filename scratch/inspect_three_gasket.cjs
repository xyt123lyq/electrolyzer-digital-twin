const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to http://localhost:5180 ...');
  await page.goto('http://localhost:5180', { waitUntil: 'networkidle', timeout: 60000 });
  
  console.log('Page loaded. Waiting for 3D scene initialization...');
  await page.waitForFunction(() => typeof window.__scene__ !== 'undefined');

  console.log('Inspecting gasket geometry in the browser context...');
  const inspection = await page.evaluate(() => {
    const scene = window.__scene__;
    const cathodePlate = scene.cell.children.find(c => c.name === 'cathodePlate');
    if (!cathodePlate) return { error: 'cathodePlate not found' };

    // Find black gasket mesh in cathodePlate
    // It's added to cathodePlate, zPos = +T/2
    // Let's list all meshes in cathodePlate
    const meshes = [];
    cathodePlate.traverse(c => {
      if (c.isMesh) {
        meshes.push({
          name: c.name || 'unnamed',
          type: c.geometry ? c.geometry.type : 'unknown',
          positionZ: c.position.z,
          color: c.material.color ? c.material.color.getHexString() : 'none',
          shapesCount: c.geometry && c.geometry.parameters && c.geometry.parameters.shapes ? 1 : 0,
          holesCount: c.geometry && c.geometry.parameters && c.geometry.parameters.shapes && c.geometry.parameters.shapes.holes ? c.geometry.parameters.shapes.holes.length : 0
        });
      }
    });

    return {
      meshes,
      cellState: scene.cell.userData.state
    };
  });

  console.log('Inspection results:', JSON.stringify(inspection, null, 2));

  await browser.close();
  console.log('Done.');
})();
