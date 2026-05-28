const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log('Navigating to http://localhost:5180 ...');
  await page.goto('http://localhost:5180', { waitUntil: 'networkidle', timeout: 60000 });
  
  console.log('Page loaded. Waiting for 3D scene initialization...');
  await page.waitForFunction(() => typeof window.__scene__ !== 'undefined');

  console.log('Querying gasket meshes...');
  const inspection = await page.evaluate(() => {
    const scene = window.__scene__;
    
    // Find all meshes in the scene with gasket material color (151515)
    const gasketMeshes = [];
    scene.scene.traverse(c => {
      if (c.isMesh && c.material && c.material.color && c.material.color.getHexString() === '151515') {
        const parentName = c.parent ? c.parent.name : 'none';
        gasketMeshes.push({
          parentName,
          type: c.geometry ? c.geometry.type : 'unknown',
          positionZ: c.position.z,
          visible: c.visible,
          shapesCount: c.geometry && c.geometry.parameters && c.geometry.parameters.shapes ? 1 : 0,
          holesInfo: c.geometry && c.geometry.parameters && c.geometry.parameters.shapes && c.geometry.parameters.shapes.holes 
            ? c.geometry.parameters.shapes.holes.map(h => ({
                curvesCount: h.curves ? h.curves.length : 0,
                firstCurveType: h.curves && h.curves[0] ? h.curves[0].type : 'none'
              }))
            : 'none'
        });
      }
    });

    return gasketMeshes;
  });

  console.log('Gasket Meshes in Scene:', JSON.stringify(inspection, null, 2));

  await browser.close();
  console.log('Done.');
})();
