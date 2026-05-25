"""
Note: this is a HEADLESS BROWSER test against the Vite dev server, so it does NOT
go through Electron IPC (window.electronAPI is undefined in the browser).
But we can still verify the UI button shows correct fallback (hidden) when no Electron.
For a real Electron test, you need to open the Electron app directly.

Here we just check: page loads, UI renders without errors, button is hidden when no electronAPI.
"""
from playwright.sync_api import sync_playwright

CHROME = r'C:\Users\LYQDZH\AppData\Local\ms-playwright\chromium-1217\chrome-win64\chrome.exe'

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path=CHROME)
    ctx = b.new_context(viewport={'width': 1920, 'height': 1080})
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda err: errors.append(str(err)))
    page.on('console', lambda msg: errors.append(f'[{msg.type}] {msg.text}') if msg.type == 'error' else None)

    page.goto('http://localhost:5173/', wait_until='networkidle')
    page.wait_for_timeout(2000)

    # Check no JS errors loading the controller
    if errors:
        print('!! Errors:')
        for e in errors[:5]: print(' ', e)
    else:
        print('OK: no pageerror or console.error')

    # Check controller has the expected buttons (no recorder ones in browser since no electronAPI)
    btns = page.locator('.explosion-controller .btn').count()
    print(f'controller buttons: {btns}')

    page.screenshot(path=r'C:\Users\LYQDZH\Desktop\电解水\三层电解槽\_tools\test_shots\after_recorder_changes.png')
    b.close()
