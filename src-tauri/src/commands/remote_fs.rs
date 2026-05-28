use crate::commands::transfer::{
    register, unregister, wait_while_paused, TransferControl, TransferProgress, CANCELLED_MSG,
};
use crate::models::{Connection, FileEntry, Protocol};
use crate::services::connection_manager;
use crate::services::ftp::FtpClient;
use crate::services::sftp::SftpClient;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter};

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
pub fn test_connection(mut connection: Connection) -> Result<String, String> {
    // The frontend may pass a Connection without a password (the field is
    // `#[serde(skip_serializing)]` so it never round-trips through
    // `getConnections`). For previously-saved connections, recover the
    // password from the secure store before we try to log in.
    if connection.password.is_none() || connection.password.as_deref() == Some("") {
        if let Ok(Some(pw)) = connection_manager::get_password(&connection.id) {
            connection.password = Some(pw);
        }
    }

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

// ---------------------------------------------------------------------------
// Recursive transfers with progress + cancel/pause + configurable
// parallelism.
//
// Strategy:
//   1. With a single FTP/SFTP connection, walk the source tree to collect
//      a flat list of file-level work items + the directories that must
//      exist on the destination.
//   2. Create destination directories serially (so workers don't race).
//   3. Spawn N worker threads — each holds its own FTP/SFTP connection
//      and pulls items from a shared queue. Progress and cancel/pause
//      flags are shared via Arc<Mutex<…>> / Arc<AtomicBool>.
// ---------------------------------------------------------------------------

use std::sync::Mutex;
use std::thread;

fn basename(p: &str) -> &str {
    let trimmed = p.trim_end_matches('/');
    trimmed.rsplit('/').next().unwrap_or(p)
}

fn remote_join(parent: &str, name: &str) -> String {
    if parent.ends_with('/') {
        format!("{}{}", parent, name)
    } else {
        format!("{}/{}", parent, name)
    }
}

fn cancelled_err() -> String {
    CANCELLED_MSG.to_string()
}

fn emit(app: &AppHandle, p: &TransferProgress) {
    let _ = app.emit("transfer-progress", p);
}

fn clamp_parallel(n: Option<usize>) -> usize {
    n.unwrap_or(4).clamp(1, 16)
}

#[derive(Clone)]
struct FileWork {
    /// Absolute remote path (for download) or absolute local path (for upload)
    source: String,
    /// Absolute destination path (local for download / remote for upload)
    target: String,
    /// Best-effort size for progress totals (0 if unknown, e.g. some FTP listings)
    size: u64,
}

// ---- pre-scan helpers ----

fn ftp_collect(
    client: &mut FtpClient,
    remote: &str,
    is_dir: bool,
    size_hint: u64,
    local_target: &Path,
    files: &mut Vec<FileWork>,
    local_dirs: &mut Vec<PathBuf>,
    ctl: &TransferControl,
) -> Result<(), String> {
    if ctl.cancelled.load(Ordering::SeqCst) {
        return Err(cancelled_err());
    }
    if is_dir {
        local_dirs.push(local_target.to_path_buf());
        for entry in client.list_dir(remote)? {
            let child_remote = remote_join(remote, &entry.name);
            let child_local = local_target.join(&entry.name);
            ftp_collect(
                client, &child_remote, entry.is_directory, entry.size,
                &child_local, files, local_dirs, ctl,
            )?;
        }
    } else {
        files.push(FileWork {
            source: remote.to_string(),
            target: local_target.to_string_lossy().to_string(),
            size: size_hint,
        });
    }
    Ok(())
}

fn sftp_collect(
    client: &SftpClient,
    remote: &str,
    is_dir: bool,
    size_hint: u64,
    local_target: &Path,
    files: &mut Vec<FileWork>,
    local_dirs: &mut Vec<PathBuf>,
    ctl: &TransferControl,
) -> Result<(), String> {
    if ctl.cancelled.load(Ordering::SeqCst) {
        return Err(cancelled_err());
    }
    if is_dir {
        local_dirs.push(local_target.to_path_buf());
        for entry in client.list_dir(remote)? {
            let child_remote = remote_join(remote, &entry.name);
            let child_local = local_target.join(&entry.name);
            sftp_collect(
                client, &child_remote, entry.is_directory, entry.size,
                &child_local, files, local_dirs, ctl,
            )?;
        }
    } else {
        files.push(FileWork {
            source: remote.to_string(),
            target: local_target.to_string_lossy().to_string(),
            size: size_hint,
        });
    }
    Ok(())
}

fn local_collect_for_upload(
    local: &Path,
    remote_target: &str,
    files: &mut Vec<FileWork>,
    remote_dirs: &mut Vec<String>,
    ctl: &TransferControl,
) -> Result<(), String> {
    if ctl.cancelled.load(Ordering::SeqCst) {
        return Err(cancelled_err());
    }
    let meta = std::fs::metadata(local)
        .map_err(|e| format!("stat {}: {}", local.display(), e))?;
    if meta.is_dir() {
        remote_dirs.push(remote_target.to_string());
        for entry in std::fs::read_dir(local)
            .map_err(|e| format!("read_dir {}: {}", local.display(), e))?
        {
            let entry = entry.map_err(|e| format!("read_dir entry: {}", e))?;
            let name = entry.file_name().to_string_lossy().to_string();
            let child_local = entry.path();
            let child_remote = remote_join(remote_target, &name);
            local_collect_for_upload(&child_local, &child_remote, files, remote_dirs, ctl)?;
        }
    } else {
        files.push(FileWork {
            source: local.to_string_lossy().to_string(),
            target: remote_target.to_string(),
            size: meta.len(),
        });
    }
    Ok(())
}

// ---- shared progress state ----

#[derive(Clone)]
struct SharedProgress {
    inner: std::sync::Arc<Mutex<TransferProgress>>,
    app: AppHandle,
}

impl SharedProgress {
    fn new(app: AppHandle, p: TransferProgress) -> Self {
        Self {
            inner: std::sync::Arc::new(Mutex::new(p)),
            app,
        }
    }

    fn snapshot(&self) -> TransferProgress {
        self.inner.lock().unwrap().clone()
    }

    fn start_file(&self, name: &str, total: u64) {
        let mut p = self.inner.lock().unwrap();
        p.current_file = name.to_string();
        p.file_total = total;
        p.file_bytes = 0;
        emit(&self.app, &p);
    }

    fn finish_file(&self, bytes: u64) {
        let mut p = self.inner.lock().unwrap();
        p.items_done += 1;
        p.bytes_done += bytes;
        p.file_bytes = bytes;
        p.file_total = bytes;
        emit(&self.app, &p);
    }

    fn set_status(&self, status: &str, msg: Option<String>) {
        let mut p = self.inner.lock().unwrap();
        p.status = status.into();
        p.message = msg;
        emit(&self.app, &p);
    }

    fn set_totals(&self, items: usize, bytes: u64, status: &str) {
        let mut p = self.inner.lock().unwrap();
        p.items_total = items;
        p.bytes_total = bytes;
        p.status = status.into();
        emit(&self.app, &p);
    }
}

// ---- worker functions ----

fn worker_download_ftp(
    conn: Connection,
    queue: std::sync::Arc<Mutex<Vec<FileWork>>>,
    progress: SharedProgress,
    ctl: TransferControl,
    error_slot: std::sync::Arc<Mutex<Option<String>>>,
) {
    let mut client = match FtpClient::connect(&conn) {
        Ok(c) => c,
        Err(e) => {
            *error_slot.lock().unwrap() = Some(e);
            ctl.cancelled.store(true, Ordering::SeqCst);
            return;
        }
    };
    loop {
        if wait_while_paused(&ctl) {
            break;
        }
        let work = match queue.lock().unwrap().pop() {
            Some(w) => w,
            None => break,
        };
        progress.start_file(&work.source, work.size);
        match client.download_file(&work.source, &work.target) {
            Ok(n) => progress.finish_file(n),
            Err(e) => {
                *error_slot.lock().unwrap() = Some(format!("{}: {}", work.source, e));
                ctl.cancelled.store(true, Ordering::SeqCst);
                break;
            }
        }
    }
    let _ = client.disconnect();
}

fn worker_upload_ftp(
    conn: Connection,
    queue: std::sync::Arc<Mutex<Vec<FileWork>>>,
    progress: SharedProgress,
    ctl: TransferControl,
    error_slot: std::sync::Arc<Mutex<Option<String>>>,
) {
    let mut client = match FtpClient::connect(&conn) {
        Ok(c) => c,
        Err(e) => {
            *error_slot.lock().unwrap() = Some(e);
            ctl.cancelled.store(true, Ordering::SeqCst);
            return;
        }
    };
    loop {
        if wait_while_paused(&ctl) {
            break;
        }
        let work = match queue.lock().unwrap().pop() {
            Some(w) => w,
            None => break,
        };
        progress.start_file(&work.source, work.size);
        match client.upload_file(&work.source, &work.target) {
            Ok(n) => progress.finish_file(n),
            Err(e) => {
                *error_slot.lock().unwrap() = Some(format!("{}: {}", work.source, e));
                ctl.cancelled.store(true, Ordering::SeqCst);
                break;
            }
        }
    }
    let _ = client.disconnect();
}

fn worker_download_sftp(
    conn: Connection,
    queue: std::sync::Arc<Mutex<Vec<FileWork>>>,
    progress: SharedProgress,
    ctl: TransferControl,
    error_slot: std::sync::Arc<Mutex<Option<String>>>,
) {
    let client = match SftpClient::connect(&conn) {
        Ok(c) => c,
        Err(e) => {
            *error_slot.lock().unwrap() = Some(e);
            ctl.cancelled.store(true, Ordering::SeqCst);
            return;
        }
    };
    loop {
        if wait_while_paused(&ctl) {
            break;
        }
        let work = match queue.lock().unwrap().pop() {
            Some(w) => w,
            None => break,
        };
        progress.start_file(&work.source, work.size);
        match client.download_file(&work.source, &work.target) {
            Ok(n) => progress.finish_file(n),
            Err(e) => {
                *error_slot.lock().unwrap() = Some(format!("{}: {}", work.source, e));
                ctl.cancelled.store(true, Ordering::SeqCst);
                break;
            }
        }
    }
    let _ = client.disconnect();
}

fn worker_upload_sftp(
    conn: Connection,
    queue: std::sync::Arc<Mutex<Vec<FileWork>>>,
    progress: SharedProgress,
    ctl: TransferControl,
    error_slot: std::sync::Arc<Mutex<Option<String>>>,
) {
    let client = match SftpClient::connect(&conn) {
        Ok(c) => c,
        Err(e) => {
            *error_slot.lock().unwrap() = Some(e);
            ctl.cancelled.store(true, Ordering::SeqCst);
            return;
        }
    };
    loop {
        if wait_while_paused(&ctl) {
            break;
        }
        let work = match queue.lock().unwrap().pop() {
            Some(w) => w,
            None => break,
        };
        progress.start_file(&work.source, work.size);
        match client.upload_file(&work.source, &work.target) {
            Ok(n) => progress.finish_file(n),
            Err(e) => {
                *error_slot.lock().unwrap() = Some(format!("{}: {}", work.source, e));
                ctl.cancelled.store(true, Ordering::SeqCst);
                break;
            }
        }
    }
    let _ = client.disconnect();
}

// ---- top-level commands ----

#[tauri::command]
pub fn remote_copy_to_local(
    app: AppHandle,
    transfer_id: String,
    connection_id: String,
    remote_paths: Vec<String>,
    is_dir: Vec<bool>,
    local_dest: String,
    parallel: Option<usize>,
) -> Result<u64, String> {
    if remote_paths.len() != is_dir.len() {
        return Err("remote_paths and is_dir must have the same length".into());
    }
    let parallel = clamp_parallel(parallel);
    let dest = PathBuf::from(&local_dest);
    std::fs::create_dir_all(&dest)
        .map_err(|e| format!("create_dir_all {}: {}", dest.display(), e))?;

    let conn = get_connection_with_password(&connection_id)?;
    let ctl = register(&transfer_id);

    let initial = TransferProgress {
        transfer_id: transfer_id.clone(),
        kind: "download".into(),
        current_file: String::new(),
        file_bytes: 0,
        file_total: 0,
        items_done: 0,
        items_total: 0,
        bytes_done: 0,
        bytes_total: 0,
        status: "scanning".into(),
        message: None,
    };
    let progress = SharedProgress::new(app.clone(), initial.clone());
    emit(&app, &initial);

    let result: Result<u64, String> = (|| {
        // 1. Pre-scan with one connection.
        let mut files: Vec<FileWork> = Vec::new();
        let mut dirs: Vec<PathBuf> = Vec::new();
        match conn.protocol {
            Protocol::Ftp => {
                let mut client = FtpClient::connect(&conn)?;
                for (remote, &d) in remote_paths.iter().zip(is_dir.iter()) {
                    let target = dest.join(basename(remote));
                    ftp_collect(&mut client, remote, d, 0, &target, &mut files, &mut dirs, &ctl)?;
                }
                let _ = client.disconnect();
            }
            Protocol::Sftp => {
                let client = SftpClient::connect(&conn)?;
                for (remote, &d) in remote_paths.iter().zip(is_dir.iter()) {
                    let target = dest.join(basename(remote));
                    sftp_collect(&client, remote, d, 0, &target, &mut files, &mut dirs, &ctl)?;
                }
                let _ = client.disconnect();
            }
        }

        // 2. Create destination dirs serially.
        for d in &dirs {
            std::fs::create_dir_all(d)
                .map_err(|e| format!("create_dir_all {}: {}", d.display(), e))?;
        }

        let total_items = files.len();
        let total_bytes: u64 = files.iter().map(|f| f.size).sum();
        progress.set_totals(total_items, total_bytes, "running");

        if total_items == 0 {
            progress.set_status("done", None);
            return Ok(0);
        }

        // Reverse so pop() gives stable-ish order (front first).
        files.reverse();
        let queue = std::sync::Arc::new(Mutex::new(files));
        let error_slot: std::sync::Arc<Mutex<Option<String>>> =
            std::sync::Arc::new(Mutex::new(None));

        // 3. Spawn workers. Cap at queue size to avoid useless connections.
        let workers = parallel.min(total_items.max(1));
        let mut handles = Vec::with_capacity(workers);
        for _ in 0..workers {
            let conn = conn.clone();
            let queue = queue.clone();
            let progress = progress.clone();
            let ctl = ctl.clone();
            let error_slot = error_slot.clone();
            let h = match conn.protocol {
                Protocol::Ftp => thread::spawn(move || {
                    worker_download_ftp(conn, queue, progress, ctl, error_slot)
                }),
                Protocol::Sftp => thread::spawn(move || {
                    worker_download_sftp(conn, queue, progress, ctl, error_slot)
                }),
            };
            handles.push(h);
        }
        for h in handles {
            let _ = h.join();
        }

        if let Some(err) = error_slot.lock().unwrap().clone() {
            // If user cancelled we surface that; otherwise propagate worker error.
            if ctl.cancelled.load(Ordering::SeqCst) && !err.contains(CANCELLED_MSG) {
                return Err(err);
            }
            return Err(err);
        }

        if ctl.cancelled.load(Ordering::SeqCst) {
            return Err(cancelled_err());
        }

        let snap = progress.snapshot();
        progress.set_status("done", None);
        Ok(snap.bytes_done)
    })();

    unregister(&transfer_id);

    match result {
        Ok(v) => Ok(v),
        Err(e) if e == CANCELLED_MSG => {
            progress.set_status("cancelled", None);
            Err("Transfer cancelled".into())
        }
        Err(e) => {
            progress.set_status("error", Some(e.clone()));
            Err(e)
        }
    }
}

#[tauri::command]
pub fn remote_copy_from_local(
    app: AppHandle,
    transfer_id: String,
    connection_id: String,
    local_paths: Vec<String>,
    remote_dest: String,
    parallel: Option<usize>,
) -> Result<u64, String> {
    let parallel = clamp_parallel(parallel);
    let conn = get_connection_with_password(&connection_id)?;
    let ctl = register(&transfer_id);

    let initial = TransferProgress {
        transfer_id: transfer_id.clone(),
        kind: "upload".into(),
        current_file: String::new(),
        file_bytes: 0,
        file_total: 0,
        items_done: 0,
        items_total: 0,
        bytes_done: 0,
        bytes_total: 0,
        status: "scanning".into(),
        message: None,
    };
    let progress = SharedProgress::new(app.clone(), initial.clone());
    emit(&app, &initial);

    let result: Result<u64, String> = (|| {
        // 1. Pre-scan local sources.
        let mut files: Vec<FileWork> = Vec::new();
        let mut remote_dirs: Vec<String> = Vec::new();
        for local in &local_paths {
            let path = Path::new(local);
            let name = path
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .ok_or_else(|| format!("Cannot derive name from {}", local))?;
            let target = remote_join(&remote_dest, &name);
            local_collect_for_upload(path, &target, &mut files, &mut remote_dirs, &ctl)?;
        }

        // 2. Create destination dirs serially with one connection.
        match conn.protocol {
            Protocol::Ftp => {
                let mut client = FtpClient::connect(&conn)?;
                let _ = client.mkdir(&remote_dest);
                for d in &remote_dirs {
                    let _ = client.mkdir(d);
                }
                let _ = client.disconnect();
            }
            Protocol::Sftp => {
                let client = SftpClient::connect(&conn)?;
                let _ = client.mkdir(&remote_dest);
                for d in &remote_dirs {
                    let _ = client.mkdir(d);
                }
                let _ = client.disconnect();
            }
        }

        let total_items = files.len();
        let total_bytes: u64 = files.iter().map(|f| f.size).sum();
        progress.set_totals(total_items, total_bytes, "running");

        if total_items == 0 {
            progress.set_status("done", None);
            return Ok(0);
        }

        files.reverse();
        let queue = std::sync::Arc::new(Mutex::new(files));
        let error_slot: std::sync::Arc<Mutex<Option<String>>> =
            std::sync::Arc::new(Mutex::new(None));

        let workers = parallel.min(total_items.max(1));
        let mut handles = Vec::with_capacity(workers);
        for _ in 0..workers {
            let conn = conn.clone();
            let queue = queue.clone();
            let progress = progress.clone();
            let ctl = ctl.clone();
            let error_slot = error_slot.clone();
            let h = match conn.protocol {
                Protocol::Ftp => thread::spawn(move || {
                    worker_upload_ftp(conn, queue, progress, ctl, error_slot)
                }),
                Protocol::Sftp => thread::spawn(move || {
                    worker_upload_sftp(conn, queue, progress, ctl, error_slot)
                }),
            };
            handles.push(h);
        }
        for h in handles {
            let _ = h.join();
        }

        if let Some(err) = error_slot.lock().unwrap().clone() {
            return Err(err);
        }
        if ctl.cancelled.load(Ordering::SeqCst) {
            return Err(cancelled_err());
        }
        let snap = progress.snapshot();
        progress.set_status("done", None);
        Ok(snap.bytes_done)
    })();

    unregister(&transfer_id);

    match result {
        Ok(v) => Ok(v),
        Err(e) if e == CANCELLED_MSG => {
            progress.set_status("cancelled", None);
            Err("Transfer cancelled".into())
        }
        Err(e) => {
            progress.set_status("error", Some(e.clone()));
            Err(e)
        }
    }
}
