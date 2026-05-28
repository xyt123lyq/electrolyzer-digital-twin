import sys
sys.stdout.reconfigure(encoding='utf-8')

from playwright.sync_api import sync_playwright

results = {
    "console_errors": [],
    "screenshot_saved": False,
    "flow_channel_button_found": False,
    "flow_channel_button_text": None,
    "all_buttons": [],
    "all_text_content": [],
    "page_title": None,
    "navigation_success": False,
    "canvas_count": 0,
}

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})

    # Capture console messages
    def on_console(msg):
        if msg.type == "error":
            results["console_errors"].append(msg.text)

    page.on("console", on_console)

    # Capture page errors
    def on_page_error(err):
        results["console_errors"].append(f"PAGE ERROR: {err}")

    page.on("pageerror", on_page_error)

    # Navigate to the app
    print("Navigating to http://localhost:5181/ ...")
    try:
        response = page.goto("http://localhost:5181/", timeout=15000)
        results["navigation_success"] = True
        print(f"Navigation status: {response.status if response else 'No response'}")
    except Exception as e:
        print(f"Navigation failed: {e}")
        results["console_errors"].append(f"Navigation error: {e}")

    # Wait for 3D scene to load
    print("Waiting for 3D scene to load...")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(4000)  # Extra wait for WebGL/Three.js to initialize

    results["page_title"] = page.title()
    print(f"Page title: {results['page_title']}")

    # Take screenshot
    screenshot_path = "C:/Users/LYQDZH/Desktop/电解水/三层电解槽/test_screenshot.png"
    page.screenshot(path=screenshot_path, full_page=False)
    results["screenshot_saved"] = True
    print(f"Screenshot saved to: {screenshot_path}")

    # Check for "流道分析" button - try multiple methods
    flow_keywords = ["流道分析", "流道", "flow", "Flow", "channel", "Channel"]

    # Method 1: Get all text content on the page
    body_text = page.locator("body").inner_text()
    results["all_text_content"] = body_text
    print("\n--- Page text content (first 2000 chars) ---")
    print(body_text[:2000])

    # Method 2: Try to find "流道分析" by text
    for keyword in flow_keywords:
        try:
            count = page.get_by_text(keyword, exact=False).count()
            if count > 0:
                print(f"\nFound keyword '{keyword}' count={count}")
        except Exception as e:
            pass

    # Collect all buttons
    try:
        all_buttons = page.locator("button").all()
        for btn in all_buttons:
            try:
                txt = btn.inner_text()
                if txt.strip():
                    results["all_buttons"].append(txt)
            except Exception:
                pass
        print(f"\nAll visible buttons: {results['all_buttons']}")
    except Exception as e:
        print(f"Error collecting buttons: {e}")

    # Check for canvas (Three.js 3D scene)
    results["canvas_count"] = page.locator("canvas").count()
    print(f"Canvas elements found: {results['canvas_count']}")

    # Look for any element containing "流道" or related terms
    try:
        liudao = page.locator("[class*='flow'], [class*='liudao'], [id*='flow'], [id*='liudao']").all()
        print(f"Elements with flow/liudao in class/id: {len(liudao)}")
    except:
        pass

    browser.close()

# Print summary
print("\n" + "=" * 60)
print("RESULTS SUMMARY")
print("=" * 60)
print(f"Navigation success: {results['navigation_success']}")
print(f"Page title: {results['page_title']}")
print(f"Console errors ({len(results['console_errors'])}):")
for err in results["console_errors"]:
    print(f"  - {err}")
print(f"Canvas elements: {results['canvas_count']}")
print(f"Screenshot saved: {results['screenshot_saved']}")
print(f"Visible buttons ({len(results['all_buttons'])}): {results['all_buttons']}")