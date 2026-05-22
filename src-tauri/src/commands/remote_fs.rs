use crate::models::{Connection, FileEntry, Protocol};
use crate::services::connection_manager;
use crate::services::ftp::FtpClient;
use crate::services::sftp::SftpClient;

fn get_connection_with_password(connection_id: &str) -> Result<Connection, String> {
    let mut conn = connection_manager::get_connection(connection_id)?;
    if conn.password.is_none() || conn.password.as_deref() == Some("") {
        if let Ok(Some(pw)) = connection_manager::get_password(connection_id) {
            conn.password = Some(pw);
        }
    }
    Ok(conn)
}

#[tauri::command]
pub fn remote_list_dir(connection_id: String, path: String) -> Result<Vec<FileEntry>, String> {
    let conn = get_connection_with_password(&connection_id)?;
    match conn.protocol {
        Protocol::Ftp => {
            let mut client = FtpClient::connect(&conn)?;
            let result = client.list_dir(&path);
            client.disconnect().ok();
            result
        }
        Protocol::Sftp => {
            let client = SftpClient::connect(&conn)?;
            let result = client.list_dir(&path);
            client.disconnect().ok();
            result
        }
    }
}

#[tauri::command]
pub fn remote_download(
    connection_id: String,
    remote_path: String,
    local_path: String,
) -> Result<u64, String> {
    let conn = get_connection_with_password(&connection_id)?;
    match conn.protocol {
        Protocol::Ftp => {
            let mut client = FtpClient::connect(&conn)?;
            let result = client.download_file(&remote_path, &local_path);
            client.disconnect().ok();
            result
        }
        Protocol::Sftp => {
            let client = SftpClient::connect(&conn)?;
            let result = client.download_file(&remote_path, &local_path);
            client.disconnect().ok();
            result
        }
    }
}

#[tauri::command]
pub fn remote_upload(
    connection_id: String,
    local_path: String,
    remote_path: String,
) -> Result<u64, String> {
    let conn = get_connection_with_password(&connection_id)?;
    match conn.protocol {
        Protocol::Ftp => {
            let mut client = FtpClient::connect(&conn)?;
            let result = client.upload_file(&local_path, &remote_path);
            client.disconnect().ok();
            result
        }
        Protocol::Sftp => {
            let client = SftpClient::connect(&conn)?;
            let result = client.upload_file(&local_path, &remote_path);
            client.disconnect().ok();
            result
        }
    }
}

#[tauri::command]
pub fn remote_mkdir(connection_id: String, path: String) -> Result<(), String> {
    let conn = get_connection_with_password(&connection_id)?;
    match conn.protocol {
        Protocol::Ftp => {
            let mut client = FtpClient::connect(&conn)?;
            let result = client.mkdir(&path);
            client.disconnect().ok();
            result
        }
        Protocol::Sftp => {
            let client = SftpClient::connect(&conn)?;
            let result = client.mkdir(&path);
            client.disconnect().ok();
            result
        }
    }
}

#[tauri::command]
pub fn remote_delete(connection_id: String, paths: Vec<String>, is_dir: Vec<bool>) -> Result<(), String> {
    let conn = get_connection_with_password(&connection_id)?;
    match conn.protocol {
        Protocol::Ftp => {
            let mut client = FtpClient::connect(&conn)?;
            for (path, dir) in paths.iter().zip(is_dir.iter()) {
                if *dir {
                    client.remove_dir(path)?;
                } else {
                    client.remove_file(path)?;
                }
            }
            client.disconnect().ok();
            Ok(())
        }
        Protocol::Sftp => {
            let client = SftpClient::connect(&conn)?;
            for (path, dir) in paths.iter().zip(is_dir.iter()) {
                if *dir {
                    client.remove_dir(path)?;
                } else {
                    client.remove_file(path)?;
                }
            }
            client.disconnect().ok();
            Ok(())
        }
    }
}

#[tauri::command]
pub fn remote_rename(connection_id: String, from: String, to: String) -> Result<(), String> {
    let conn = get_connection_with_password(&connection_id)?;
    match conn.protocol {
        Protocol::Ftp => {
            let mut client = FtpClient::connect(&conn)?;
            let result = client.rename(&from, &to);
            client.disconnect().ok();
            result
        }
        Protocol::Sftp => {
            let client = SftpClient::connect(&conn)?;
            let result = client.rename(&from, &to);
            client.disconnect().ok();
            result
        }
    }
}

#[tauri::command]
pub fn remote_chmod(connection_id: String, path: String, mode: u32) -> Result<(), String> {
    let conn = get_connection_with_password(&connection_id)?;
    match conn.protocol {
        Protocol::Sftp => {
            let client = SftpClient::connect(&conn)?;
            let result = client.chmod(&path, mode);
            client.disconnect().ok();
            result
        }
        Protocol::Ftp => Err("chmod is not supported over FTP".to_string()),
    }
}

#[tauri::command]
pub fn test_connection(connection: Connection) -> Result<String, String> {
    match connection.protocol {
        Protocol::Ftp => {
            let mut client = FtpClient::connect(&connection)?;
            let pwd = client.pwd()?;
            client.disconnect().ok();
            Ok(format!("Connected successfully. Remote dir: {}", pwd))
        }
        Protocol::Sftp => {
            let client = SftpClient::connect(&connection)?;
            let files = client.list_dir(&connection.remote_path)?;
            client.disconnect().ok();
            Ok(format!("Connected successfully. {} items in remote dir.", files.len()))
        }
    }
}
