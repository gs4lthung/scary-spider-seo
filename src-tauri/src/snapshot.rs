//! Saving and loading crawl snapshot files, as plain functions so they can be tested
//! without Tauri state. `commands::save_crawl` / `load_crawl` / `read_crawl_snapshot`
//! call into these.

use crate::crawler::types::{CrawlSnapshot, CrawlSnapshotRef};
use std::fs::File;
use std::io::BufWriter;
use std::path::{Path, PathBuf};

/// The sibling file a save is written to before it replaces `path`: `<path>.tmp`.
fn temp_path(path: &Path) -> PathBuf {
    let mut name = path.as_os_str().to_os_string();
    name.push(".tmp");
    PathBuf::from(name)
}

/// Streams `snapshot` as compact JSON into `<path>.tmp` through a buffered writer, then
/// renames it over `path`. A failed save (serialization, disk full, unwritable location)
/// leaves any existing file at `path` untouched and removes the partial temp file.
pub fn write_snapshot(path: &Path, snapshot: &CrawlSnapshotRef<'_>) -> Result<(), String> {
    let tmp = temp_path(path);
    let result = write_to(&tmp, snapshot).and_then(|()| std::fs::rename(&tmp, path));
    if result.is_err() {
        // Best effort: the temp file may not exist (create failed) or may be a directory.
        let _ = std::fs::remove_file(&tmp);
    }
    result.map_err(|e| e.to_string())
}

fn write_to(tmp: &Path, snapshot: &CrawlSnapshotRef<'_>) -> std::io::Result<()> {
    let mut writer = BufWriter::new(File::create(tmp)?);
    serde_json::to_writer(&mut writer, snapshot)?;
    let file = writer.into_inner().map_err(|e| e.into_error())?;
    file.sync_all()
}

/// Reads and parses a saved crawl file, compact or pretty-printed. Fields missing from
/// crawls saved by older builds take their `#[serde(default)]` values.
pub fn read_snapshot(path: &Path) -> Result<CrawlSnapshot, String> {
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    serde_json::from_slice(&bytes).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::{read_snapshot, temp_path, write_snapshot};
    use crate::crawler::types::{
        CrawlSnapshot, CrawlSnapshotRef, CustomSearchRule, ExtractionMode, ExtractionRule,
    };
    use std::path::PathBuf;

    const LEGACY: &str = include_str!("../tests/fixtures/legacy-snapshot.json");

    /// A fresh, empty directory under the system temp dir, unique per test.
    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("gseo-snapshot-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn legacy() -> CrawlSnapshot {
        serde_json::from_str(LEGACY).unwrap()
    }

    fn as_ref(snapshot: &CrawlSnapshot) -> CrawlSnapshotRef<'_> {
        CrawlSnapshotRef {
            start_url: &snapshot.start_url,
            saved_at_unix_ms: snapshot.saved_at_unix_ms,
            pages: &snapshot.pages,
            resources: snapshot.resources.iter().collect(),
            custom_searches: &snapshot.custom_searches,
            extractions: &snapshot.extractions,
        }
    }

    #[test]
    fn save_then_load_round_trips() {
        let dir = temp_dir("round-trip");
        let path = dir.join("crawl.json");
        let mut original = legacy();
        original.custom_searches = vec![CustomSearchRule {
            id: "cs1".to_string(),
            name: "Prices".to_string(),
            pattern: "\\$[0-9]+".to_string(),
            is_regex: true,
            ..Default::default()
        }];
        original.extractions = vec![ExtractionRule {
            id: "ex1".to_string(),
            name: "Price".to_string(),
            selector: ".price".to_string(),
            mode: ExtractionMode::Text,
            attr: None,
        }];

        write_snapshot(&path, &as_ref(&original)).unwrap();
        let loaded = read_snapshot(&path).unwrap();
        let tmp_left = temp_path(&path).exists();
        let _ = std::fs::remove_dir_all(&dir);

        assert!(!tmp_left, "temp file is renamed away");
        // Compare through JSON: the snapshot types don't implement PartialEq.
        assert_eq!(
            serde_json::to_value(&loaded).unwrap(),
            serde_json::to_value(&original).unwrap()
        );
        assert_eq!(loaded.custom_searches.len(), 1);
        assert_eq!(loaded.extractions[0].selector, ".price");
    }

    #[test]
    fn loads_a_pretty_printed_legacy_file() {
        let dir = temp_dir("legacy");
        let path = dir.join("legacy.json");
        // The fixture is pretty-printed, as every save before T4.4 was.
        assert!(LEGACY.contains("\n  \"startUrl\""));
        std::fs::write(&path, LEGACY).unwrap();
        let loaded = read_snapshot(&path);
        let _ = std::fs::remove_dir_all(&dir);

        let loaded = loaded.expect("pretty-printed legacy file loads");
        assert_eq!(loaded.start_url, "https://legacy.example/");
        assert_eq!(loaded.pages.len(), 2);
        assert_eq!(loaded.resources.len(), 1);
        assert!(loaded.custom_searches.is_empty());
        assert!(loaded.extractions.is_empty());
    }

    #[test]
    fn failed_save_keeps_the_previous_file() {
        let dir = temp_dir("failed-save");
        let path = dir.join("crawl.json");
        std::fs::write(&path, LEGACY).unwrap();
        // A directory where the temp file should go makes the save fail before `path` is
        // touched, the same way a full disk or a permissions error would.
        std::fs::create_dir(temp_path(&path)).unwrap();

        let mut other = legacy();
        other.start_url = "https://other.example/".to_string();
        let err = write_snapshot(&path, &as_ref(&other)).unwrap_err();
        let kept = std::fs::read_to_string(&path).unwrap();
        let _ = std::fs::remove_dir_all(&dir);

        assert!(!err.is_empty());
        assert_eq!(kept, LEGACY);
    }

    #[test]
    fn failed_save_to_a_directory_path_reports_an_error() {
        let dir = temp_dir("dir-path");
        let err = write_snapshot(&dir, &as_ref(&legacy()));
        let still_dir = dir.is_dir();
        let _ = std::fs::remove_dir_all(&dir);
        assert!(err.is_err());
        assert!(still_dir);
    }

    #[test]
    fn compact_output_is_smaller_than_pretty() {
        let dir = temp_dir("compact");
        let path = dir.join("crawl.json");
        let snapshot = legacy();
        write_snapshot(&path, &as_ref(&snapshot)).unwrap();
        let compact = std::fs::read(&path).unwrap();
        let _ = std::fs::remove_dir_all(&dir);

        let pretty = serde_json::to_vec_pretty(&snapshot).unwrap();
        assert!(
            compact.len() < pretty.len(),
            "compact {} >= pretty {}",
            compact.len(),
            pretty.len()
        );
        assert!(!compact.contains(&b'\n'));
    }
}
