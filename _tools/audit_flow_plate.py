"""
Visually verify whether the '阳极流道板' (flow1) actually shows serpentine
channel geometry. Drive the running Vite dev server at localhost:5173 via
Playwright, explode Cell 2, take a close-up + full shot, and dump the
children of the flow1 Group.
"""
import os
import json
from playwright.sync_api import sync_playwright

SHOTS_DIR = r'C:\Users\LYQDZH\Desktop\电解水\三层电解槽\_tools\test_shots'
os.makedirs(SHOTS_DIR, exist_ok=True)

VIEWPORT = {'width': 1920, 'height': 1080}
CHROME_EXE = r'C:\Users\LYQDZH\AppData\Local\ms-playwright\chromium-1217\chrome-win64\chrome.exe'

CLOSEUP_PATH = os.path.join(SHOTS_DIR, 'flow1_closeup.png')
FULL_PATH    = os.path.join(SHOTS_DIR, 'cell2_full.png')

CLOSEUP_W, CLOSEUP_H = 800, 500
FULL_W, FULL_H = 1400, 900


def clip_box(cx, cy, w, h, vw=VIEWPORT['width'], vh=VIEWPORT['height']):
    x = max(0, min(vw - w, int(cx - w / 2)))
    y = max(0, min(vh - h, int(cy - h / 2)))
    return {'x': x, 'y': y, 'width': w, 'height': h}


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path=CHROME_EXE)
        ctx = browser.new_context(viewport=VIEWPORT)
        page = ctx.new_page()

        page.on('pageerror', lambda err: print(f'  [pageerror] {err}'))
        page.on('console', lambda msg: (
            print(f'  [browser:{msg.type}] {msg.text[:300]}')
            if msg.type in ('error', 'warning') else None
        ))

        print('[1] navigate to http://localhost:5173/')
        page.goto('http://localhost:5173/', wait_until='networkidle', timeout=30000)
        page.wait_for_timeout(1500)

        # confirm scene exposed
        ok = page.evaluate('!!window.__scene__')
        print(f'    window.__scene__ exposed: {ok}')

        print('[2] press D to stop auto-demo, R to reset')
        page.keyboard.press('d'); page.wait_for_timeout(400)
        page.keyboard.press('r'); page.wait_for_timeout(1200)

        print('[3] press 2 to explode Cell 2, wait 4s')
        page.keyboard.press('2')
        page.wait_for_timeout(4000)

        # Grab flow1 world center -> project to screen
        info = page.evaluate(r'''
() => {
  const s = window.__scene__;
  if (!s) return { error: 'no __scene__' };
  const THREE = s.THREE || (s.cells[0].userData.layers.flow1.children[0]?.geometry ? null : null);
  const flow1 = s.cells[1].userData.layers.flow1;
  const v = flow1.getWorldPosition(new (window.THREE_NS ? window.THREE_NS.Vector3 : (s.cells[0].position.constructor))());
  const scr = s.projectToScreen(v);
  // Bounding box in world space
  const box = { min: {x:Infinity,y:Infinity,z:Infinity}, max:{x:-Infinity,y:-Infinity,z:-Infinity} };
  flow1.traverse(o => {
    if (o.isMesh && o.geometry) {
      o.geometry.computeBoundingBox?.();
      const bb = o.geometry.boundingBox;
      if (!bb) return;
      const wp = o.getWorldPosition(new v.constructor());
      // approximate: just take object world position
      box.min.x = Math.min(box.min.x, wp.x + bb.min.x);
      box.min.y = Math.min(box.min.y, wp.y + bb.min.y);
      box.max.x = Math.max(box.max.x, wp.x + bb.max.x);
      box.max.y = Math.max(box.max.y, wp.y + bb.max.y);
    }
  });
  return {
    worldCenter: [v.x.toFixed(2), v.y.toFixed(2), v.z.toFixed(2)],
    screen: scr,
    childCount: flow1.children.length,
    cameraPos: [s.camera.position.x.toFixed(1), s.camera.position.y.toFixed(1), s.camera.position.z.toFixed(1)],
    box: box,
  };
}
        ''')
        print('    flow1 info:', json.dumps(info, ensure_ascii=False, indent=2))

        scr = info['screen']
        cx, cy = scr['x'], scr['y']
        print(f'    flow1 screen center = ({cx:.1f}, {cy:.1f})')

        print('[4] take close-up screenshot of flow1')
        clip = clip_box(cx, cy, CLOSEUP_W, CLOSEUP_H)
        page.screenshot(path=CLOSEUP_PATH, clip=clip)
        print(f'    -> {CLOSEUP_PATH}  clip={clip}')

        print('[5] take wider Cell-2 panorama')
        full_clip = clip_box(cx, cy, FULL_W, FULL_H)
        page.screenshot(path=FULL_PATH, clip=full_clip)
        print(f'    -> {FULL_PATH}  clip={full_clip}')

        print('[6] dump flow1.children list (sorted by world position.y desc)')
        children = page.evaluate(r'''
() => {
  const s = window.__scene__;
  const flow1 = s.cells[1].userData.layers.flow1;
  const Vec = s.cells[0].position.constructor;
  const out = [];
  for (const child of flow1.children) {
    const wp = new Vec();
    child.getWorldPosition(wp);
    let geoInfo = null;
    if (child.geometry) {
      child.geometry.computeBoundingBox?.();
      const bb = child.geometry.boundingBox;
      geoInfo = {
        type: child.geometry.type,
        bbox: bb ? {
          min: [bb.min.x.toFixed(3), bb.min.y.toFixed(3), bb.min.z.toFixed(3)],
          max: [bb.max.x.toFixed(3), bb.max.y.toFixed(3), bb.max.z.toFixed(3)],
          size: [
            (bb.max.x - bb.min.x).toFixed(3),
            (bb.max.y - bb.min.y).toFixed(3),
            (bb.max.z - bb.min.z).toFixed(3),
          ],
        } : null,
        params: child.geometry.parameters || null,
      };
    }
    out.push({
      name: child.name || '(unnamed)',
      type: child.type,
      isMesh: !!child.isMesh,
      isGroup: !!child.isGroup,
      worldPos: [wp.x.toFixed(3), wp.y.toFixed(3), wp.z.toFixed(3)],
      localPos: [child.position.x.toFixed(3), child.position.y.toFixed(3), child.position.z.toFixed(3)],
      scale:    [child.scale.x.toFixed(3), child.scale.y.toFixed(3), child.scale.z.toFixed(3)],
      childCount: child.children?.length || 0,
      geometry: geoInfo,
      material: child.material ? {
        type: child.material.type,
        color: child.material.color ? '#' + child.material.color.getHexString() : null,
        opacity: child.material.opacity,
        transparent: child.material.transparent,
      } : null,
    });
  }
  out.sort((a, b) => parseFloat(b.worldPos[1]) - parseFloat(a.worldPos[1]));
  return out;
}
        ''')

        print(f'\n=== flow1 has {len(children)} direct children (sorted by world.y desc) ===')
        for i, c in enumerate(children):
            geo = c.get('geometry') or {}
            size = geo.get('bbox', {}).get('size') if geo and geo.get('bbox') else None
            print(f'[{i:02d}] name="{c["name"]}" type={c["type"]} '
                  f'worldPos=({c["worldPos"][0]},{c["worldPos"][1]},{c["worldPos"][2]}) '
                  f'localPos=({c["localPos"][0]},{c["localPos"][1]},{c["localPos"][2]}) '
                  f'kids={c["childCount"]} '
                  f'geoType={geo.get("type")} size={size} '
                  f'color={c.get("material",{}).get("color") if c.get("material") else None}')

        # Save JSON dump too for reference
        dump_path = os.path.join(SHOTS_DIR, 'flow1_children.json')
        with open(dump_path, 'w', encoding='utf-8') as f:
            json.dump({'info': info, 'children': children}, f, ensure_ascii=False, indent=2)
        print(f'\n    JSON dump -> {dump_path}')

        browser.close()
        print('\n[done]')


if __name__ == '__main__':
    main()
