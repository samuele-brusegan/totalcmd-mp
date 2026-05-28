mod commands;
mod models;
mod services;

use tauri::Manager;

/// PNG bytes for the window/taskbar icon, embedded at build time.
/// We set it explicitly at runtime because on some Linux desktop
/// environments the WM does not pick up the icon from the bundle config
/// during dev (no .desktop file installed yet).
const WINDOW_ICON_PNG: &[u8] = include_bytes!("../icons/128x128.png");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Apply the embedded icon to all current windows. Decoding the
            // PNG once avoids touching the filesystem at runtime.
            if let Ok(decoded) = image::load_from_memory(WINDOW_ICON_PNG) {
                let rgba = decoded.to_rgba8();
                let (w, h) = rgba.dimensions();
                let icon =
                    tauri::image::Image::new_owned(rgba.into_raw(), w, h);
                for (_, window) in app.webview_windows() {
                    let _ = window.set_icon(icon.clone());
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::local_fs::list_local_dir,
            commands::local_fs::get_home_dir,
            commands::local_fs::create_dir,
            commands::local_fs::delete_items,
            commands::local_fs::rename_item,
            commands::local_fs::copy_items,
            commands::local_fs::move_items,
            commands::local_fs::get_drives,
            commands::local_fs::read_file_text,
            commands::local_fs::search_files,
            commands::local_fs::chmod_local,
            commands::connections::get_connections,
            commands::connections::save_connection,
            commands::connections::update_connection,
            commands::connections::delete_connection,
            commands::remote_fs::remote_list_dir,
            commands::remote_fs::remote_download,
            commands::remote_fs::remote_upload,
            commands::remote_fs::remote_mkdir,
            commands::remote_fs::remote_delete,
            commands::remote_fs::remote_rename,
            commands::remote_fs::remote_chmod,
            commands::remote_fs::test_connection,
            commands::remote_fs::remote_copy_to_local,
            commands::remote_fs::remote_copy_from_local,
            commands::transfer::transfer_cancel,
            commands::transfer::transfer_set_paused,
            commands::git::git_is_repo,
            commands::git::git_status,
            commands::git::git_log,
            commands::git::git_diff,
            commands::git::git_stage,
            commands::git::git_unstage,
            commands::git::git_commit,
            commands::git::git_branches,
            commands::git::git_checkout,
            commands::git::git_fetch,
            commands::git::git_pull,
            commands::git::git_push,
            commands::tls_inspect::inspect_ftps_certificate,
            commands::window_layout::get_window_button_layout,
            commands::editor::editor_prepare_remote,
            commands::editor::editor_finish_remote,
            commands::editor::editor_spawn_external,
            commands::local_fs::write_file_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
