// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Works around a WebKitGTK bug where the DMA-BUF renderer never paints,
    // leaving a blank white window — seen on AppImage builds with NVIDIA/Wayland
    // and some virtualized/Intel GPU setups. Must be set before the webview inits.
    #[cfg(target_os = "linux")]
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

    tauri_app_lib::run()
}
