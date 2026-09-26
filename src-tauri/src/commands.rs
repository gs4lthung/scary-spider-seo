use crate::crawler::crawl;
use crate::crawler::custom::{CustomSearch, Extraction};
use crate::crawler::scope::UrlScope;
use crate::crawler::types::{
    CrawlConfig, CrawlSnapshot, CrawlSnapshotRef, CrawlSummary, CustomSearchRule, ExtractionRule,
    PageResult, ResourceResult, MAX_LIST_URLS,
};
use crate::export;
use crate::snapshot;
use crate::state::AppState;
use std::path::Path;
use std::sync::atomic::Ordering;
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};

fn lock_state<T>(mutex: &Mutex<T>) -> Result<MutexGuard<'_, T>, String> {
    mutex
        .lock()
        .map_err(|_| "Application state lock is poisoned".to_string())
}

#[tauri::command]
pub async fn start_crawl(
    app: AppHandle,
    state: State<'_, AppState>,
    config: CrawlConfig,
) -> Result<(), String> {
    if state.running.load(Ordering::SeqCst) {
        return Err("A crawl is already running".to_string());
    }

    // Reject bad include/exclude patterns and custom searches up front, before any state is touched, so
    // the user can fix them without losing the current results or resume state.
    validate_config(&config)?;

    // A stopped crawl left queued URLs behind for this exact start URL — continue from
    // there instead of clearing everything and starting over. A resume state for a
    // different start URL is stale (e.g. the user changed the URL after stopping) and
    // is discarded here so that crawl starts fresh.
    // List mode never consumes resume state: the list is crawled from scratch, and any
    // spider crawl's leftover frontier no longer matches the cleared results.
    let resume = match lock_state(&state.resume_state)?.take() {
        Some(r) if !config.is_list_mode() && r.start_url == config.start_url => Some(r),
        _ => None,
    };

    if resume.is_none() {
        lock_state(&state.pages)?.clear();
        state.resources.clear();
        state.resources_checked.store(0, Ordering::SeqCst);
    }
    state.cancel.store(false, Ordering::SeqCst);
    state.paused.store(false, Ordering::SeqCst);
    state.running.store(true, Ordering::SeqCst);

    let running = state.running.clone();
    let cancel = state.cancel.clone();
    let paused = state.paused.clone();
    let pages = state.pages.clone();
    let resources = state.resources.clone();
    let resources_checked = state.resources_checked.clone();
    let resume_state = state.resume_state.clone();
    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let linked_urls = crawl::run_crawl(
            app_handle.clone(),
            config,
            crawl::CrawlState {
                cancel: cancel.clone(),
                paused,
                pages: pages.clone(),
                resources: resources.clone(),
                resources_checked: resources_checked.clone(),
                resume_slot: resume_state.clone(),
            },
            resume,
        )
        .await;
        running.store(false, Ordering::SeqCst);
        let cancelled = cancel.load(Ordering::SeqCst);
        let resumable = match resume_state.lock() {
            Ok(guard) => guard.is_some(),
            Err(_) => {
                let _ = app_handle.emit(
                    "crawl://error",
                    "Application resume state lock is poisoned".to_string(),
                );
                false
            }
        };
        let pages_crawled = match pages.lock() {
            Ok(guard) => guard.len(),
            Err(_) => {
                let _ = app_handle.emit(
                    "crawl://error",
                    "Application pages state lock is poisoned".to_string(),
                );
                0
            }
        };
        let resources_checked = resources_checked.load(Ordering::Relaxed);
        let _ = app_handle.emit(
            "crawl://done",
            CrawlSummary {
                pages_crawled,
                resources_checked,
                cancelled,
                resumable,
                linked_urls,
            },
        );
    });

    Ok(())
}

/// Every check `start_crawl` runs before touching state: include/exclude patterns,
/// custom search rules, custom extraction selectors and the list size.
fn validate_config(config: &CrawlConfig) -> Result<(), String> {
    UrlScope::new(&config.include_patterns, &config.exclude_patterns)?;
    CustomSearch::new(&config.custom_searches)?;
    Extraction::new(&config.extractions)?;
    check_list_size(config)
}

/// Rejects a list-mode crawl over `MAX_LIST_URLS` entries before any state is touched.
fn check_list_size(config: &CrawlConfig) -> Result<(), String> {
    if config.list_urls.len() > MAX_LIST_URLS {
        return Err(format!(
            "List mode accepts at most {MAX_LIST_URLS} URLs; this list has {}.",
            config.list_urls.len()
        ));
    }
    Ok(())
}

#[tauri::command]
pub fn stop_crawl(state: State<'_, AppState>) -> Result<(), String> {
    state.cancel.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn pause_crawl(state: State<'_, AppState>) -> Result<(), String> {
    state.paused.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn resume_crawl(state: State<'_, AppState>) -> Result<(), String> {
    state.paused.store(false, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn get_pages(state: State<'_, AppState>) -> Result<Vec<PageResult>, String> {
    Ok(lock_state(&state.pages)?.clone())
}

#[tauri::command]
pub fn get_resources(state: State<'_, AppState>) -> Result<Vec<ResourceResult>, String> {
    Ok(state.resources.iter().map(|r| r.value().clone()).collect())
}

/// `custom_searches` and `extractions` are the rules of the results on screen (sent by the
/// frontend, which keeps them for live and loaded crawls); they name the pages CSV's custom
/// search and extraction columns.
#[tauri::command]
pub fn export_csv(
    state: State<'_, AppState>,
    path: String,
    what: String,
    custom_searches: Option<Vec<CustomSearchRule>>,
    extractions: Option<Vec<ExtractionRule>>,
) -> Result<(), String> {
    match what.as_str() {
        "pages" => {
            let pages = lock_state(&state.pages)?;
            export::export_pages_csv(
                &pages,
                &custom_searches.unwrap_or_default(),
                &extractions.unwrap_or_default(),
                &path,
            )
            .map_err(|e| e.to_string())
        }
        "resources" => {
            let resources: Vec<ResourceResult> =
                state.resources.iter().map(|r| r.value().clone()).collect();
            export::export_resources_csv(&resources, &path).map_err(|e| e.to_string())
        }
        "links" => {
            let pages = lock_state(&state.pages)?;
            export::export_links_csv(&pages, &path).map_err(|e| e.to_string())
        }
        _ => Err(format!("Unknown export type: {what}")),
    }
}

#[tauri::command]
pub async fn save_crawl(
    state: State<'_, AppState>,
    path: String,
    start_url: String,
    custom_searches: Option<Vec<CustomSearchRule>>,
    extractions: Option<Vec<ExtractionRule>>,
) -> Result<(), String> {
    let saved_at_unix_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let meta = SaveMeta {
        start_url,
        saved_at_unix_ms,
        custom_searches: custom_searches.unwrap_or_default(),
        extractions: extractions.unwrap_or_default(),
    };
    let state = AppState::clone(&state);
    // Serializing and writing a large crawl takes a while; keep it off the UI thread.
    tauri::async_runtime::spawn_blocking(move || save_state(&state, Path::new(&path), &meta))
        .await
        .map_err(|e| e.to_string())?
}

/// The parts of a saved crawl that don't come from `AppState`.
struct SaveMeta {
    start_url: String,
    saved_at_unix_ms: u64,
    custom_searches: Vec<CustomSearchRule>,
    extractions: Vec<ExtractionRule>,
}

impl SaveMeta {
    fn snapshot_ref<'a>(
        &'a self,
        pages: &'a [PageResult],
        resources: Vec<&'a ResourceResult>,
    ) -> CrawlSnapshotRef<'a> {
        CrawlSnapshotRef {
            start_url: &self.start_url,
            saved_at_unix_ms: self.saved_at_unix_ms,
            pages,
            resources,
            custom_searches: &self.custom_searches,
            extractions: &self.extractions,
        }
    }
}

/// Writes the crawl in `state` to `path` (what `save_crawl` does off the UI thread).
///
/// While a crawl is running, pages and resources are cloned under their locks and the
/// locks are released before the (slow) serialize, write and fsync, so the crawl loop
/// never waits on a save. With no crawl running nothing contends for the locks, so the
/// file is streamed straight from the locked state with no copy.
fn save_state(state: &AppState, path: &Path, meta: &SaveMeta) -> Result<(), String> {
    if state.running.load(Ordering::SeqCst) {
        let pages = lock_state(&state.pages)?.clone();
        let resources: Vec<ResourceResult> =
            state.resources.iter().map(|r| r.value().clone()).collect();
        snapshot::write_snapshot(path, &meta.snapshot_ref(&pages, resources.iter().collect()))
    } else {
        let pages = lock_state(&state.pages)?;
        let guards: Vec<_> = state.resources.iter().collect();
        let resources = guards.iter().map(|r| r.value()).collect();
        snapshot::write_snapshot(path, &meta.snapshot_ref(&pages, resources))
    }
}

#[tauri::command]
pub async fn load_crawl(state: State<'_, AppState>, path: String) -> Result<CrawlSnapshot, String> {
    let state = AppState::clone(&state);
    // Reading, parsing and copying a large crawl into state takes a while; keep it off the
    // UI thread.
    tauri::async_runtime::spawn_blocking(move || {
        let snapshot = parse_snapshot_file(&path)?;
        apply_snapshot(&state, &snapshot)?;
        Ok(snapshot)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Reads and parses a saved crawl file (compact or pretty-printed, any build's format).
fn parse_snapshot_file(path: &str) -> Result<CrawlSnapshot, String> {
    snapshot::read_snapshot(Path::new(path))
}

/// Replaces the current crawl in `state` with `snapshot` (what `load_crawl` does after parsing).
fn apply_snapshot(state: &AppState, snapshot: &CrawlSnapshot) -> Result<(), String> {
    // A loaded snapshot has no in-progress frontier of its own — any leftover resume
    // state from an earlier stopped crawl no longer corresponds to what's in `pages`
    // now, so it must not be silently resumed into on the next start_crawl.
    *lock_state(&state.resume_state)? = None;
    *lock_state(&state.pages)? = snapshot.pages.clone();
    state.resources.clear();
    for r in &snapshot.resources {
        state.resources.insert(r.url.clone(), r.clone());
    }
    state.resources_checked.store(
        snapshot
            .resources
            .iter()
            .filter(|resource| resource.status_text != "Checking")
            .count(),
        Ordering::Relaxed,
    );
    Ok(())
}

/// Parses a saved crawl and returns it without touching `AppState` (unlike `load_crawl`), so
/// the Compare view can read two crawls while the current crawl stays as it is. Async and
/// parsed on a blocking thread so a large file never stalls the UI thread.
#[tauri::command]
pub async fn read_crawl_snapshot(path: String) -> Result<CrawlSnapshot, String> {
    tauri::async_runtime::spawn_blocking(move || parse_snapshot_file(&path))
        .await
        .map_err(|e| e.to_string())?
}

/// Writes text built by the frontend (e.g. the bulk issues CSV, whose rows come from the
/// frontend's issue classification) to `path`, replacing any existing file.
#[tauri::command]
pub fn save_text_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::{
        apply_snapshot, check_list_size, parse_snapshot_file, read_crawl_snapshot, save_state,
        save_text_file, validate_config, SaveMeta,
    };
    use crate::crawler::types::CrawlSnapshot;
    use crate::crawler::types::{
        CrawlConfig, CustomSearchRule, ExtractionMode, ExtractionRule, MAX_LIST_URLS,
    };
    use crate::state::AppState;
    use std::sync::atomic::Ordering;

    fn list_config(len: usize) -> CrawlConfig {
        let mut config: CrawlConfig =
            serde_json::from_str(r#"{"startUrl":"https://example.com/"}"#).unwrap();
        config.list_urls = (0..len)
            .map(|i| format!("https://example.com/{i}"))
            .collect();
        config
    }

    #[test]
    fn list_at_the_cap_is_accepted() {
        assert!(check_list_size(&list_config(MAX_LIST_URLS)).is_ok());
    }

    #[test]
    fn list_over_the_cap_is_rejected_with_its_size() {
        let err = check_list_size(&list_config(MAX_LIST_URLS + 1)).unwrap_err();
        assert!(err.contains("50000"), "{err}");
        assert!(err.contains(&(MAX_LIST_URLS + 1).to_string()), "{err}");
    }

    #[test]
    fn invalid_custom_search_is_rejected_before_the_crawl() {
        let mut config = list_config(0);
        assert!(validate_config(&config).is_ok());
        config.custom_searches = vec![CustomSearchRule {
            id: "cs1".to_string(),
            name: "Prices".to_string(),
            pattern: "[0-9".to_string(),
            is_regex: true,
            ..Default::default()
        }];
        let err = validate_config(&config).unwrap_err();
        assert!(err.contains("\"Prices\""), "{err}");
    }

    #[test]
    fn invalid_extraction_selector_is_rejected_before_the_crawl() {
        let mut config = list_config(0);
        config.extractions = vec![ExtractionRule {
            id: "ex1".to_string(),
            name: "Price".to_string(),
            selector: ".price >".to_string(),
            mode: ExtractionMode::Text,
            attr: None,
        }];
        let err = validate_config(&config).unwrap_err();
        assert!(err.contains("\"Price\""), "{err}");
        config.extractions[0].selector = ".price".to_string();
        assert!(validate_config(&config).is_ok());
    }

    #[test]
    fn save_text_file_writes_contents_verbatim() {
        let path = std::env::temp_dir().join(format!("gseo-save-text-{}.csv", std::process::id()));
        let contents = "\u{feff}\"URL\",\"Issue\"\r\n\"https://example.com/caf\u{e9}\",\"x\"\r\n";
        save_text_file(path.to_string_lossy().into_owned(), contents.to_string()).unwrap();
        let written = std::fs::read(&path).unwrap();
        let _ = std::fs::remove_file(&path);
        assert_eq!(written, contents.as_bytes());
    }

    #[test]
    fn save_text_file_reports_errors_as_strings() {
        let dir = std::env::temp_dir();
        // A directory path can't be written as a file.
        let err = save_text_file(dir.to_string_lossy().into_owned(), String::new()).unwrap_err();
        assert!(!err.is_empty());
    }

    fn temp_snapshot_file(name: &str, snapshot: &CrawlSnapshot) -> std::path::PathBuf {
        let path = std::env::temp_dir().join(format!("gseo-{name}-{}.json", std::process::id()));
        std::fs::write(&path, serde_json::to_string(snapshot).unwrap()).unwrap();
        path
    }

    #[test]
    fn read_crawl_snapshot_leaves_state_untouched() {
        let legacy: CrawlSnapshot =
            serde_json::from_str(include_str!("../tests/fixtures/legacy-snapshot.json")).unwrap();
        let state = AppState::default();
        let mut current = legacy.clone();
        current.pages.truncate(1);
        current.resources.clear();
        apply_snapshot(&state, &current).unwrap();

        let path = temp_snapshot_file("read-snapshot", &legacy);
        let read = tauri::async_runtime::block_on(read_crawl_snapshot(
            path.to_string_lossy().into_owned(),
        ));
        let _ = std::fs::remove_file(&path);

        let read = read.expect("snapshot reads");
        assert_eq!(read.pages.len(), legacy.pages.len());
        assert_eq!(read.resources.len(), legacy.resources.len());
        let pages = state.pages.lock().unwrap();
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].url, current.pages[0].url);
        assert!(state.resources.is_empty());
    }

    #[test]
    fn read_crawl_snapshot_reports_parse_errors_as_strings() {
        let path =
            std::env::temp_dir().join(format!("gseo-bad-snapshot-{}.json", std::process::id()));
        std::fs::write(&path, "not json").unwrap();
        let err = parse_snapshot_file(&path.to_string_lossy()).unwrap_err();
        let _ = std::fs::remove_file(&path);
        assert!(!err.is_empty());
    }

    fn saved_meta(start_url: &str) -> SaveMeta {
        SaveMeta {
            start_url: start_url.to_string(),
            saved_at_unix_ms: 42,
            custom_searches: Vec::new(),
            extractions: Vec::new(),
        }
    }

    /// Saves the legacy fixture from `AppState` with the crawl flagged running or idle and
    /// checks the file loads back with the same pages and resources.
    fn save_state_round_trips(running: bool) {
        let legacy: CrawlSnapshot =
            serde_json::from_str(include_str!("../tests/fixtures/legacy-snapshot.json")).unwrap();
        let state = AppState::default();
        apply_snapshot(&state, &legacy).unwrap();
        state.running.store(running, Ordering::SeqCst);

        let dir =
            std::env::temp_dir().join(format!("gseo-save-state-{running}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("crawl.json");
        let saved = save_state(&state, &path, &saved_meta(&legacy.start_url));
        let loaded = parse_snapshot_file(&path.to_string_lossy());
        let _ = std::fs::remove_dir_all(&dir);

        saved.expect("save succeeds");
        let loaded = loaded.expect("saved file loads");
        assert_eq!(loaded.start_url, legacy.start_url);
        assert_eq!(loaded.saved_at_unix_ms, 42);
        assert_eq!(
            serde_json::to_value(&loaded.pages).unwrap(),
            serde_json::to_value(&legacy.pages).unwrap()
        );
        assert_eq!(loaded.resources.len(), legacy.resources.len());
        assert_eq!(loaded.resources[0].url, legacy.resources[0].url);
        // The save released every lock: the crawl can keep writing afterwards.
        assert!(state.pages.try_lock().is_ok());
        assert!(state
            .resources
            .try_get_mut(&legacy.resources[0].url)
            .is_present());
    }

    #[test]
    fn save_state_while_crawl_is_running_saves_a_copy() {
        save_state_round_trips(true);
    }

    #[test]
    fn save_state_when_idle_streams_from_state() {
        save_state_round_trips(false);
    }
}
