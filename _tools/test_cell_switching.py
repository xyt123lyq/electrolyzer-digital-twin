"""
Drive the electrolyzer app via Playwright, take screenshots of cell views
in both windowed and fullscreen modes. Iterate camera/framing parameters.
"""
import os
import sys
import time
from playwright.sync_api import sync_playwright

SHOTS_DIR = r'C:\Users\LYQDZH\Desktop\电解水\三层电解槽\_tools\test_shots'
os.makedirs(SHOTS_DIR, exist_ok=True)

VIEWPORT = {'width': 1920, 'height': 1080}
CHROME_EXE = r'C:\Users\LYQDZH\AppData\Local\ms-playwright\chromium-1217\chrome-win64\chrome.exe'

def shot(page, name, full=False):
    path = os.path.join(SHOTS_DIR, name + '.png')
    page.screenshot(path=path, full_page=full)
    # Also dump cell state JSON
    try:
        state = page.evaluate('''() => {
          // Find the ElectrolyzerScene via globally exposed __scene__ if available
          const s = window.__scene__;
          if (!s) return {error: 'no __scene__ exposed'};
          return {
            activeCellIndex: s.activeCellIndex,
            autoRotate: s.autoRotate,
            cellAssemblyRotY: s.cellAssembly?.rotation?.y,
            cameraPos: s.camera ? [s.camera.position.x.toFixed(1), s.camera.position.y.toFixed(1), s.camera.position.z.toFixed(1)] : null,
            controlsTarget: s.controls ? [s.controls.target.x.toFixed(1), s.controls.target.y.toFixed(1), s.controls.target.z.toFixed(1)] : null,
            cells: s.cells.map((c, i) => {
              const layers = c.userData.layers;
              const memOpacity = layers?.membrane?.material?.opacity;
              const cond1Opacity = layers?.cond1?.material?.opacity;
              return {
                idx: i,
                state: c.userData.state,
                pos: [c.position.x.toFixed(1), c.position.y.toFixed(1), c.position.z.toFixed(1)],
                memOpacity: memOpacity?.toFixed(2),
                cond1Opacity: cond1Opacity?.toFixed(2),
                cond1LayerZ: layers?.cond1?.position?.z?.toFixed(1),
                cond2LayerZ: layers?.cond2?.position?.z?.toFixed(1),
              };
            })
          };
        }''')
        print(f'  -> {os.path.basename(path)}  state={state}')
    except Exception as e:
        print(f'  -> {os.path.basename(path)}  (state dump failed: {e})')
    return path

def click_cell(page, n, wait_ms=3500):
    """Click cell button by keyboard shortcut (avoid CJK locator encoding issues)."""
    page.keyboard.press(str(n))
    page.wait_for_timeout(wait_ms)

def reset_app(page):
    """Trigger reset via keyboard shortcut R."""
    page.keyboard.press('r')
    page.wait_for_timeout(1000)

def stop_demo_via_js(page):
    """Stop auto-demo by directly calling the scene API via window-exposed handle.
       (Toggle button has CJK label that confuses Playwright locator.)"""
    # We need the scene's stopAutoDemo. The Vue component exposes some methods on
    # the electrolyzerRef. We can stop demo by clicking the toggle button by
    # selecting by class or by the 'D' keyboard hint.
    page.keyboard.press('d')
    page.wait_for_timeout(500)

def go_fullscreen(page):
    """Click the F (fullscreen) shortcut. This triggers element.requestFullscreen()
       which may not work in headless. As an alternative, expand the 3D area via CSS."""
    page.keyboard.press('f')
    page.wait_for_timeout(800)

def shrink_to_fullscreen_3d(page):
    """Force the 3D area to take the full viewport (simulating fullscreen mode)
       by injecting CSS — headless Playwright requestFullscreen() is unreliable."""
    page.add_style_tag(content='''
        .layout { display: block !important; padding: 0 !important; }
        .header, .right-params, .bottom-row { display: none !important; }
        .threeD-area { width: 100vw !important; height: 100vh !important; position: fixed !important; top: 0; left: 0; }
    ''')
    page.wait_for_timeout(500)
    # Trigger resize so Three.js camera aspect updates
    page.evaluate('window.dispatchEvent(new Event("resize"))')
    page.wait_for_timeout(800)

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=CHROME_EXE)
        ctx = browser.new_context(viewport=VIEWPORT)
        page = ctx.new_page()

        # Suppress noisy logs; surface errors only
        page.on('pageerror', lambda err: print(f'  [pageerror] {err}'))
        page.on('console', lambda msg: print(f'  [browser:{msg.type}] {msg.text[:200]}') if msg.type in ('error', 'warning') else None)

        print('[1] navigate')
        page.goto('http://localhost:5173/', wait_until='networkidle', timeout=20000)
        page.wait_for_timeout(2000)
        shot(page, '00_initial')

        print('[2] stop auto-demo via D shortcut')
        stop_demo_via_js(page)

        print('[3] reset to clean state')
        reset_app(page)
        shot(page, '01_after_reset')

        # ==========  WINDOWED mode tests  ==========
        print('\n--- WINDOWED MODE ---')
        for n in (1, 2, 3):
            print(f'[W.{n}] cell {n}')
            click_cell(page, n)
            shot(page, f'win_cell{n}')
            reset_app(page)

        # ==========  FULLSCREEN mode tests  ==========
        print('\n--- FULLSCREEN (CSS-simulated) ---')
        shrink_to_fullscreen_3d(page)
        shot(page, 'fs_00_before_click')
        for n in (1, 2, 3):
            print(f'[F.{n}] cell {n} (fullscreen)')
            click_cell(page, n)
            shot(page, f'fs_cell{n}')
            reset_app(page)

        # ==========  Rapid switching stress test  ==========
        print('\n--- RAPID SWITCH STRESS (in fullscreen) ---')
        reset_app(page)
        for n in (1, 2, 3):
            click_cell(page, n, wait_ms=800)  # don't wait for full animation
        page.wait_for_timeout(3500)  # let it settle
        shot(page, 'fs_rapid_settled_on_3')

        # back-and-forth
        for n in (3, 1, 3, 2):
            click_cell(page, n, wait_ms=800)
        page.wait_for_timeout(3500)
        shot(page, 'fs_backforth_settled_on_2')

        # double click same cell
        reset_app(page)
        click_cell(page, 2, wait_ms=2500)
        click_cell(page, 2, wait_ms=3500)
        shot(page, 'fs_cell2_double_click')

        # Brutal: 10 rapid switches in 4 seconds
        print('\n--- BRUTAL 10x RAPID SWITCH ---')
        reset_app(page)
        sequence = [1, 2, 3, 1, 3, 2, 1, 3, 2, 1]
        for n in sequence:
            click_cell(page, n, wait_ms=400)   # super fast
        page.wait_for_timeout(4000)  # let settle
        shot(page, 'fs_brutal_settled_on_1')

        # End brutal with Cell 3
        sequence2 = [3, 1, 2, 3, 1, 2, 3, 2, 1, 3]
        for n in sequence2:
            click_cell(page, n, wait_ms=300)
        page.wait_for_timeout(4000)
        shot(page, 'fs_brutal2_settled_on_3')

        print('\n[done]')
        browser.close()

if __name__ == '__main__':
    main()
