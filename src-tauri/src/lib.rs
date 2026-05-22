mod commands;
mod models;
mod services;

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
            commands::remote_fs::test_connection,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
