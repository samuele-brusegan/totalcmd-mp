use crate::services::{connection_manager, ftp::FtpClient, sftp::SftpClient};
use crate::models::Protocol;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::SystemTime;

#[derive(Serialize)]
pub struct EditSession {
    pub local_path: String,
    pub original_mtime_ms: u64,
}

fn temp_dir_root() -> PathBuf {
    let dir = std::env::temp_dir().join("totalcmd-mp-edit");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn mtime_ms(path: &Path) -> Result<u64, String> {
    let meta = fs::metadata(path).map_err(|e| format!("metadata: {}", e))?;
    let modified = meta.modified().map_err(|e| format!("modified: {}", e))?;
    let dur = modified
        .duration_since(SystemTime::UNIX_EPOCH)
        .map_err(|e| format!("time: {}", e))?;
    Ok(dur.as_millis() as u64)
}

/// Download a remote file to a local temp path so it can be opened in any
/// editor. Returns the temp path + the file's mtime so the caller can detect
/// edits and re-upload only when changed.
#[tauri::command]
pub fn editor_prepare_remote(
    connection_id: String,
    remote_path: String,
) -> Result<EditSession, String> {
    let mut conn = connection_manager::get_connection(&connection_id)?;
    if conn.password.is_none() || conn.password.as_deref() == Some("") {
        if let Ok(Some(pw)) = connection_manager::get_password(&connection_id) {
            conn.password = Some(pw);
        }
    }

    let file_name = Path::new(&remote_path)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "remote".to_string());
    let unique = format!("{}-{}", uuid::Uuid::new_v4(), file_name);
    let local = temp_dir_root().join(unique);

    match conn.protocol {
        Protocol::Ftp => {
            let mut client = FtpClient::connect(&conn)?;
            client.download_file(&remote_path, &local.to_string_lossy())?;
            let _ = client.disconnect();
        }
        Protocol::Sftp => {
            let client = SftpClient::connect(&conn)?;
            client.download_file(&remote_path, &local.to_string_lossy())?;
        }
    }

    Ok(EditSession {
        local_path: local.to_string_lossy().to_string(),
        original_mtime_ms: mtime_ms(&local)?,
    })
}

/// Upload the temp file back to the remote if its mtime changed since
/// `original_mtime_ms`. Returns true if uploaded, false if untouched.
#[tauri::command]
pub fn editor_finish_remote(
    connection_id: String,
    remote_path: String,
    local_path: String,
    original_mtime_ms: u64,
) -> Result<bool, String> {
    let local = PathBuf::from(&local_path);
    let now_mtime = mtime_ms(&local)?;
    let changed = now_mtime > original_mtime_ms;

    if changed {
        let mut conn = connection_manager::get_connection(&connection_id)?;
        if conn.password.is_none() || conn.password.as_deref() == Some("") {
            if let Ok(Some(pw)) = connection_manager::get_password(&connection_id) {
                conn.password = Some(pw);
            }
        }
        match conn.protocol {
            Protocol::Ftp => {
                let mut client = FtpClient::connect(&conn)?;
                client.upload_file(&local_path, &remote_path)?;
                let _ = client.disconnect();
            }
            Protocol::Sftp => {
                let client = SftpClient::connect(&conn)?;
                client.upload_file(&local_path, &remote_path)?;
            }
        }
    }

    // Always clean up the temp file once we're done.
    let _ = fs::remove_file(&local);
    Ok(changed)
}

/// Spawn an external editor as a detached process. Splits `command` on
/// whitespace; the file path is appended as the last argument.
#[tauri::command]
pub fn editor_spawn_external(command: String, file_path: String) -> Result<(), String> {
    let parts: Vec<String> = shell_words::split(&command)
        .map_err(|e| format!("Cannot parse editor command: {}", e))?;
    if parts.is_empty() {
        return Err("Editor command is empty".into());
    }
    let (program, args) = parts.split_first().unwrap();
    let mut cmd = Command::new(program);
    cmd.args(args).arg(&file_path);
    cmd.spawn().map_err(|e| format!("Failed to launch editor: {}", e))?;
    Ok(())
}
