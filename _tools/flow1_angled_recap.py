"""Take a fresh angled close-up of flow1 plate after the serpentine geometry fix."""
from playwright.sync_api import sync_playwright

CHROME = r'C:\Users\LYQDZH\AppData\Local\ms-playwright\chromium-1217\chrome-win64\chrome.exe'

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=CHROME)
    ctx = b.new_context(viewport={'width': 1920, 'height': 1080})
    page = ctx.new_page()
    page.goto('http://localhost:5173/', wait_until='networkidle')
    page.wait_for_timeout(2000)
    page.keyboard.press('d')
    page.wait_for_timeout(400)
    page.keyboard.press('r')
    page.wait_for_timeout(1200)
    page.keyboard.press('2')
    page.wait_for_timeout(4000)

    # Override camera to angled top-down view of flow1 (extract pos from matrixWorld)
    page.evaluate('''() => {
      const s = window.__scene__;
      const flow1 = s.cells[1].userData.layers.flow1;
      flow1.updateMatrixWorld(true);
      const e = flow1.matrixWorld.elements;
      const tx = e[12], ty = e[13], tz = e[14];
      s.camera.position.set(tx + 80, ty + 120, tz + 130);
      s.controls.target.set(tx, ty, tz);
      s.controls.update();
      s.renderer.render(s.scene, s.camera);
    }''')
    page.wait_for_timeout(500)
    out = r'C:\Users\LYQDZH\Desktop\电解水\三层电解槽\_tools\test_shots\flow1_new_serpentine.png'
    page.screenshot(path=out, clip={'x': 200, 'y': 100, 'width': 1200, 'height': 800})
    print(f'saved: {out}')
    b.close()
