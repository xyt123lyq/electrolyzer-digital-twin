"""
Capture a high-res screenshot of Cell 1 exploded view, then dump exact
screen positions of the 4 labels' dots + circle elements via DOM inspection
to verify whether labels point to the right plates.
"""
from playwright.sync_api import sync_playwright

CHROME = r'C:\Users\LYQDZH\AppData\Local\ms-playwright\chromium-1217\chrome-win64\chrome.exe'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=CHROME)
    ctx = browser.new_context(viewport={'width': 1920, 'height': 1080})
    page = ctx.new_page()
    page.goto('http://localhost:5173/', wait_until='networkidle')
    page.wait_for_timeout(2000)

    # Stop demo (D), reset (R), click Cell 1, wait for explode + channel
    page.keyboard.press('d')
    page.wait_for_timeout(500)
    page.keyboard.press('r')
    page.wait_for_timeout(1200)

    # Stay in windowed mode (default layout) — that's what the user is seeing
    page.keyboard.press('2')
    page.wait_for_timeout(3500)

    # Dump label dot positions + their projected layer world positions
    data = page.evaluate('''() => {
      const s = window.__scene__;
      const cell = s.cells[1];
      const out = { activeCellIndex: s.activeCellIndex, layers: {} };
      // Use scene's own helper for screen projection (avoids needing THREE in scope)
      const screen = s.getLayerScreenPositions(1);
      for (const key of ['cond1', 'flow1', 'membrane', 'flow2', 'cond2']) {
        const layer = cell.userData.layers[key];
        const sp = screen[key];
        out.layers[key] = {
          localZ: layer.position.z.toFixed(1),
          screenXY: [sp.x.toFixed(0), sp.y.toFixed(0)],
        };
      }
      // Also get the DOM circle positions for the 4 visible labels
      const svg = document.querySelector('.leader-svg');
      const circles = Array.from(svg.querySelectorAll('circle'));
      out.circles = circles.map((c, i) => ({
        idx: i,
        cx: c.getAttribute('cx'),
        cy: c.getAttribute('cy'),
        fill: c.getAttribute('fill'),
      }));
      // And label tags
      const tags = Array.from(document.querySelectorAll('.layer-tag'));
      out.tags = tags.map(t => {
        const m = t.style.transform.match(/translate3d\\(([^,]+),\\s*([^,]+)/);
        const name = t.querySelector('.layer-tag-name')?.textContent;
        return { name, transform: t.style.transform.slice(0, 80) };
      });
      return out;
    }''')
    import json
    print(json.dumps(data, indent=2, ensure_ascii=False))

    # Also crop the 3D area only for clearer visual
    page.screenshot(path=r'C:\Users\LYQDZH\Desktop\电解水\三层电解槽\_tools\test_shots\inspect_windowed.png')
    # Crop to the 3D canvas region for zoomed view
    canvas_rect = page.evaluate('''() => {
      const el = document.querySelector(".threeD-area");
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }''')
    page.screenshot(path=r'C:\Users\LYQDZH\Desktop\电解水\三层电解槽\_tools\test_shots\inspect_3d_only.png',
                    clip={'x': canvas_rect['x'], 'y': canvas_rect['y'], 'width': canvas_rect['w'], 'height': canvas_rect['h']})
    print('\nshot saved: _tools/test_shots/inspect_labels.png')
    browser.close()
