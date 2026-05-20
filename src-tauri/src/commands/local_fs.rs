use crate::models::{DriveInfo, FileEntry};
use crate::services::local_fs as fs_service;

#[tauri::command]
pub fn list_local_dir(path: String) -> Result<Vec<FileEntry>, String> {
    fs_service::list_directory(&path)
}

#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    fs_service::get_home_directory()
}

#[tauri::command]
pub fn create_dir(path: String) -> Result<(), String> {
    fs_service::create_directory(&path)
}

#[tauri::command]
pub fn delete_items(paths: Vec<String>) -> Result<(), String> {
    fs_service::delete_items(paths)
}

#[tauri::command]
pub fn rename_item(old_path: String, new_path: String) -> Result<(), String> {
    fs_service::rename_item(&old_path, &new_path)
}

#[tauri::command]
pub fn copy_items(sources: Vec<String>, dest_dir: String) -> Result<(), String> {
    fs_service::copy_items(sources, &dest_dir)
}

#[tauri::command]
pub fn move_items(sources: Vec<String>, dest_dir: String) -> Result<(), String> {
    fs_service::move_items(sources, &dest_dir)
}

#[tauri::command]
pub fn get_drives() -> Result<Vec<DriveInfo>, String> {
    fs_service::get_drives()
}

#[tauri::command]
pub fn read_file_text(path: String, encoding: Option<String>) -> Result<String, String> {
    fs_service::read_file_text(&path, encoding)
}
