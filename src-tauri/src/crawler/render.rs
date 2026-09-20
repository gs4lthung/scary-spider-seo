use super::types::{AccessibilityViolation, MobileUsabilityViolation};
use headless_chrome::protocol::cdp::Emulation;
use headless_chrome::{Browser, LaunchOptions, Tab};
use serde_json::Value;
use std::ffi::OsStr;
use std::sync::Arc;
use url::Url;

/// Trims background work Chrome would otherwise do on every launched tab (extension
/// loading, sync, telemetry, timer throttling, etc.) — this is the same flag set
/// Puppeteer/Playwright use for headless automation, and it measurably cuts each
/// render's CPU/RAM footprint even before considering our own concurrency caps.
const LEAN_CHROME_ARGS: &[&str] = &[
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-breakpad",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-domain-reliability",
    "--disable-sync",
    "--metrics-recording-only",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
];

pub fn launch_browser() -> Result<Browser, String> {
    let options = LaunchOptions::default_builder()
        .headless(true)
        .args(LEAN_CHROME_ARGS.iter().map(OsStr::new).collect())
        .build()
        .map_err(|e| e.to_string())?;
    let browser = Browser::new(options).map_err(|e| e.to_string())?;
    if let Some(pid) = browser.get_process_id() {
        lower_browser_priority(pid);
    }
    Ok(browser)
}

/// Best-effort: drops Chrome's OS scheduling priority so a burst of concurrent
/// render/audit tabs competes less aggressively with the app's own UI thread for CPU
/// time, which is what actually caused the whole-app lag users saw with rendering
/// audits on — Chrome already runs as its own process, but at equal OS priority a
/// handful of renderer processes pegging every core still starves the UI's paint loop.
/// Failure (missing powershell, no permissions, etc.) just leaves Chrome at normal
/// priority rather than failing the crawl.
#[cfg(target_os = "windows")]
fn lower_browser_priority(pid: u32) {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let _ = Command::new("powershell")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "-NoProfile",
            "-Command",
            &format!("(Get-Process -Id {pid} -ErrorAction SilentlyContinue).PriorityClass = 'BelowNormal'"),
        ])
        .spawn();
}

#[cfg(not(target_os = "windows"))]
fn lower_browser_priority(_pid: u32) {}

/// Injects axe-core into the already-loaded page and runs an accessibility scan,
/// returning each violation with its affected node count. Best-effort: any failure
/// (axe not loading, evaluate erroring, unexpected result shape) is reported as an
/// `Err` so the caller can just fall back to an empty violation list.
fn run_axe(tab: &Tab, axe_source: &str) -> Result<Vec<AccessibilityViolation>, String> {
    tab.evaluate(axe_source, false).map_err(|e| e.to_string())?;

    let wrapped = "(async () => JSON.stringify((await axe.run()).violations))()";
    let remote = tab.evaluate(wrapped, true).map_err(|e| e.to_string())?;
    let json_str = remote
        .value
        .ok_or_else(|| "axe.run() returned no value".to_string())?;
    let json_str = json_str
        .as_str()
        .ok_or_else(|| "axe.run() result was not a string".to_string())?;

    let raw: Value = serde_json::from_str(json_str).map_err(|e| e.to_string())?;
    let mut violations = Vec::new();
    if let Value::Array(items) = raw {
        for item in items {
            let id = item
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();
            let impact = item
                .get("impact")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let description = item
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let help_url = item
                .get("helpUrl")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let node_count = item
                .get("nodes")
                .and_then(|v| v.as_array())
                .map(|a| a.len())
                .unwrap_or(0);
            violations.push(AccessibilityViolation {
                id,
                impact,
                description,
                help_url,
                node_count,
            });
        }
    }
    Ok(violations)
}

/// Runs in the page after it's been re-laid-out under a mobile viewport (see
/// `run_mobile_usability`). Mirrors the checks behind Google Search Console's "Mobile
/// Usability" report / Lighthouse's mobile-friendly audits: content wider than the
/// screen, text rendered below a comfortably readable size, and tap targets too small
/// or too close together to hit reliably with a finger.
const MOBILE_USABILITY_JS: &str = r#"(() => {
  const violations = [];

  const docWidth = document.documentElement.scrollWidth;
  const winWidth = window.innerWidth;
  if (docWidth > winWidth + 1) {
    violations.push({
      id: "content-width",
      description: `Page content is ${docWidth}px wide but the mobile viewport is only ${winWidth}px, causing horizontal scrolling.`,
      helpUrl: "https://web.dev/articles/content-width",
      nodeCount: 1,
    });
  }

  const MIN_FONT_PX = 12;
  let smallTextChars = 0;
  let totalChars = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.textContent.trim().length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  let node;
  while ((node = walker.nextNode())) {
    const el = node.parentElement;
    if (!el) continue;
    const len = node.textContent.trim().length;
    const fontSize = parseFloat(getComputedStyle(el).fontSize);
    totalChars += len;
    if (fontSize < MIN_FONT_PX) smallTextChars += len;
  }
  if (totalChars > 0 && smallTextChars / totalChars > 0.25) {
    violations.push({
      id: "font-size",
      description: `${Math.round((smallTextChars / totalChars) * 100)}% of text is smaller than ${MIN_FONT_PX}px, which can be hard to read on mobile.`,
      helpUrl: "https://web.dev/articles/font-size",
      nodeCount: smallTextChars,
    });
  }

  const MIN_TARGET_PX = 48;
  const MIN_SPACING_PX = 8;
  const selector = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [onclick]';
  const rects = Array.from(document.querySelectorAll(selector))
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0);

  let tooSmall = 0;
  for (const r of rects) {
    if (r.width < MIN_TARGET_PX || r.height < MIN_TARGET_PX) tooSmall++;
  }

  // Use a spatial grid so each target is compared only with nearby targets. The previous
  // pairwise scan was O(n^2), which made dense pages disproportionately expensive.
  let tooClose = 0;
  if (rects.length <= 600) {
    const GRID_SIZE_PX = 48;
    const grid = new Map();
    const cellKey = (x, y) => `${x}:${y}`;

    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      const minX = Math.floor((rect.left - MIN_SPACING_PX) / GRID_SIZE_PX);
      const maxX = Math.floor((rect.right + MIN_SPACING_PX) / GRID_SIZE_PX);
      const minY = Math.floor((rect.top - MIN_SPACING_PX) / GRID_SIZE_PX);
      const maxY = Math.floor((rect.bottom + MIN_SPACING_PX) / GRID_SIZE_PX);
      const candidates = new Set();

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (const candidateIndex of grid.get(cellKey(x, y)) || []) {
            candidates.add(candidateIndex);
          }
        }
      }

      for (const candidateIndex of candidates) {
        const candidate = rects[candidateIndex];
        const dx = Math.max(rect.left - candidate.right, candidate.left - rect.right, 0);
        const dy = Math.max(rect.top - candidate.bottom, candidate.top - rect.bottom, 0);
        if (dx === 0 && dy === 0) continue; // overlapping elements aren't a spacing issue
        if (dx < MIN_SPACING_PX && dy < MIN_SPACING_PX) tooClose++;
      }

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const key = cellKey(x, y);
          const cell = grid.get(key);
          if (cell) {
            cell.push(i);
          } else {
            grid.set(key, [i]);
          }
        }
      }
    }
  }

  if (tooSmall > 0) {
    violations.push({
      id: "tap-targets-size",
      description: `${tooSmall} tap target(s) are smaller than ${MIN_TARGET_PX}x${MIN_TARGET_PX}px, which can be hard to tap accurately on a touchscreen.`,
      helpUrl: "https://web.dev/articles/accessible-tap-targets",
      nodeCount: tooSmall,
    });
  }
  if (tooClose > 0) {
    violations.push({
      id: "tap-targets-spacing",
      description: `${tooClose} pair(s) of tap targets are closer than ${MIN_SPACING_PX}px apart, risking mistaps.`,
      helpUrl: "https://web.dev/articles/accessible-tap-targets",
      nodeCount: tooClose,
    });
  }

  return JSON.stringify(violations);
})()"#;

/// Emulates a common phone viewport (375x667 @2x) on the already-loaded page and runs
/// `MOBILE_USABILITY_JS` against the resulting layout. Best-effort like `run_axe`: any
/// failure just yields an empty violation list.
fn run_mobile_usability(tab: &Tab) -> Result<Vec<MobileUsabilityViolation>, String> {
    tab.call_method(Emulation::SetDeviceMetricsOverride {
        width: 375,
        height: 667,
        device_scale_factor: 2.0,
        mobile: true,
        scale: None,
        screen_width: None,
        screen_height: None,
        position_x: None,
        position_y: None,
        dont_set_visible_size: None,
        screen_orientation: None,
        viewport: None,
        display_feature: None,
        device_posture: None,
    })
    .map_err(|e| e.to_string())?;

    let remote = tab
        .evaluate(MOBILE_USABILITY_JS, false)
        .map_err(|e| e.to_string())?;
    let json_str = remote
        .value
        .ok_or_else(|| "mobile usability check returned no value".to_string())?;
    let json_str = json_str
        .as_str()
        .ok_or_else(|| "mobile usability check result was not a string".to_string())?;

    let raw: Value = serde_json::from_str(json_str).map_err(|e| e.to_string())?;
    let mut violations = Vec::new();
    if let Value::Array(items) = raw {
        for item in items {
            let id = item
                .get("id")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();
            let description = item
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let help_url = item
                .get("helpUrl")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
            let node_count = item.get("nodeCount").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
            violations.push(MobileUsabilityViolation {
                id,
                description,
                help_url,
                node_count,
            });
        }
    }
    Ok(violations)
}

/// Renders a page in a fresh browser tab, returning the post-JS-execution HTML and,
/// when requested, an accessibility violation list and/or a mobile-usability violation
/// list from the same loaded page (so each audit reflects what the browser actually
/// rendered).
pub async fn render_page(
    browser: Arc<Browser>,
    url: Url,
    axe_source: Option<Arc<String>>,
    run_mobile_usability_audit: bool,
) -> Result<
    (
        String,
        Vec<AccessibilityViolation>,
        Vec<MobileUsabilityViolation>,
    ),
    String,
> {
    tauri::async_runtime::spawn_blocking(move || {
        let tab = browser.new_tab().map_err(|e| e.to_string())?;
        let result = (|| {
            tab.navigate_to(url.as_str()).map_err(|e| e.to_string())?;
            tab.wait_until_navigated().map_err(|e| e.to_string())?;
            let html = tab.get_content().map_err(|e| e.to_string())?;
            let mobile_usability_violations = if run_mobile_usability_audit {
                run_mobile_usability(&tab).unwrap_or_default()
            } else {
                Vec::new()
            };
            let violations = match axe_source.as_deref() {
                Some(src) => run_axe(&tab, src).unwrap_or_default(),
                None => Vec::new(),
            };
            Ok((html, violations, mobile_usability_violations))
        })();
        // headless_chrome never closes a tab on its own, so a new tab per rendered
        // page (opened above) leaks — and its renderer process memory — for the
        // rest of the crawl unless we close it ourselves here.
        let _ = tab.close_target();
        result
    })
    .await
    .map_err(|e| e.to_string())?
}
