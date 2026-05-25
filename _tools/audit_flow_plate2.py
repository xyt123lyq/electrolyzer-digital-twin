"""
Second pass: zoom in EXTREMELY tight on flow1 by overriding the camera
to look straight down the +z axis at flow1's world position. This bypasses
the perspective issue and shows the plate surface head-on.
"""
import os
from playwright.sync_api import sync_playwright

SHOTS_DIR = r'C:\Users\LYQDZH\Desktop\电解水\三层电解槽\_tools\test_shots'
VIEWPORT = {'width': 1920, 'height': 1080}
CHROME_EXE = r'C:\Users\LYQDZH\AppData\Local\ms-playwright\chromium-1217\chrome-win64\chrome.exe'

OUT_TOPDOWN = os.path.join(SHOTS_DIR, 'flow1_topdown.png')
OUT_ANGLED  = os.path.join(SHOTS_DIR, 'flow1_angled.png')


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=CHROME_EXE)
        ctx = browser.new_context(viewport=VIEWPORT)
        page = ctx.new_page()
        page.on('pageerror', lambda err: print(f'  [pageerror] {err}'))

        page.goto('http://localhost:5173/', wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(1500)
        page.keyboard.press('d'); page.wait_for_timeout(400)
        page.keyboard.press('r'); page.wait_for_timeout(1000)
        page.keyboard.press('2'); page.wait_for_timeout(4000)

        # Override camera to look straight at flow1 from +z direction.
        # flow1 worldPos = (0, -36.6, 0) per previous run; but in exploded state
        # the layer's local z is offset. Read it dynamically.
        info = page.evaluate(r'''
() => {
  const s = window.__scene__;
  const flow1 = s.cells[1].userData.layers.flow1;
  const wp = flow1.getWorldPosition(new s.cells[0].position.constructor());
  // Stash original camera so we can restore (not strictly needed since we're done after).
  const cam = s.camera;
  cam.position.set(wp.x, wp.y, wp.z + 90);   // straight on, +z
  cam.up.set(0, 1, 0);
  cam.lookAt(wp);
  cam.updateMatrixWorld(true);
  if (s.controls) { s.controls.target.copy(wp); s.controls.update?.(); }
  s.renderer.render(s.scene, cam);
  return { wp: [wp.x, wp.y, wp.z] };
}
        ''')
        print('flow1 world:', info)
        page.wait_for_timeout(400)
        page.screenshot(path=OUT_TOPDOWN)
        print(f'-> {OUT_TOPDOWN}')

        # Angled view (35deg) so we can see the channel depth too
        page.evaluate(r'''
() => {
  const s = window.__scene__;
  const flow1 = s.cells[1].userData.layers.flow1;
  const wp = flow1.getWorldPosition(new s.cells[0].position.constructor());
  const dist = 95;
  const ang = 35 * Math.PI / 180;
  s.camera.position.set(
    wp.x + Math.sin(0.4) * dist * 0.4,
    wp.y + Math.sin(ang) * dist,
    wp.z + Math.cos(ang) * dist
  );
  s.camera.up.set(0, 1, 0);
  s.camera.lookAt(wp);
  s.camera.updateMatrixWorld(true);
  if (s.controls) { s.controls.target.copy(wp); s.controls.update?.(); }
  s.renderer.render(s.scene, s.camera);
}
        ''')
        page.wait_for_timeout(300)
        page.screenshot(path=OUT_ANGLED)
        print(f'-> {OUT_ANGLED}')

        browser.close()


if __name__ == '__main__':
    main()
