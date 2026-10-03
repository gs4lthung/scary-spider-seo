fn main() {
    let mut attributes = tauri_build::Attributes::new();
    // tauri-build normally embeds the Windows app manifest (Common Controls v6) into the
    // app binary only, so `cargo test` binaries that link tauri's `test` feature crash on
    // start with STATUS_ENTRYPOINT_NOT_FOUND. Embedding it via linker args instead covers
    // every binary, tests included.
    if std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc") {
        attributes = attributes
            .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest());
        let manifest = std::env::current_dir()
            .unwrap()
            .join("windows-app-manifest.xml");
        println!("cargo:rerun-if-changed={}", manifest.display());
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
        println!("cargo:rustc-link-arg=/WX");
    }
    tauri_build::try_build(attributes).expect("failed to run tauri-build");
}
