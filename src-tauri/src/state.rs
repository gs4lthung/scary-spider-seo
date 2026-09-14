use crate::crawler::crawl::CrawlResumeState;
use crate::crawler::types::{PageResult, ResourceResult};
use dashmap::DashMap;
use std::sync::atomic::{AtomicBool, AtomicUsize};
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub running: Arc<AtomicBool>,
    pub cancel: Arc<AtomicBool>,
    pub paused: Arc<AtomicBool>,
    pub pages: Arc<Mutex<Vec<PageResult>>>,
    pub resources: Arc<DashMap<String, ResourceResult>>,
    /// Incremented as each queued resource check completes, so progress events
    /// can report a count without scanning all of `resources` (O(1) vs O(n) per event).
    pub resources_checked: Arc<AtomicUsize>,
    /// Set by `run_crawl` when a crawl is stopped with URLs still queued, so the next
    /// `start_crawl` for the same start URL can continue instead of starting over.
    pub resume_state: Arc<Mutex<Option<CrawlResumeState>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            cancel: Arc::new(AtomicBool::new(false)),
            paused: Arc::new(AtomicBool::new(false)),
            pages: Arc::new(Mutex::new(Vec::new())),
            resources: Arc::new(DashMap::new()),
            resources_checked: Arc::new(AtomicUsize::new(0)),
            resume_state: Arc::new(Mutex::new(None)),
        }
    }
}
