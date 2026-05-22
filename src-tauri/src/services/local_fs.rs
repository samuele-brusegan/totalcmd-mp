use crate::models::{DriveInfo, FileEntry};
use std::fs;
use std::path::Path;
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

pub fn list_directory(path: &str) -> Result<Vec<FileEntry>, String> {
    let dir_path = Path::new(path);
    if !dir_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !dir_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let mut entries = Vec::new();

    let read_dir = fs::read_dir(dir_path).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry_result in read_dir {
        let entry = match entry_result {
            Ok(e) => e,
            Err(e) => {
                log::warn!("Failed to read entry: {}", e);
                continue;
            }
        };

        let name = entry.file_name().to_string_lossy().to_string();
        let entry_path = entry.path();
        let path_str = entry_path.to_string_lossy().to_string();

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(e) => {
                log::warn!("Failed to read metadata for {}: {}", name, e);
                entries.push(FileEntry {
                    name,
                    path: path_str,
                    is_directory: false,
                    is_symlink: false,
                    size: 0,
                    modified: None,
                    created: None,
                    extension: None,
                    permissions: None,
                });
                continue;
            }
        };

        let is_symlink = entry.file_type().map(|ft| ft.is_symlink()).unwrap_or(false);
        let is_directory = metadata.is_dir();
        let size = if is_directory { 0 } else { metadata.len() };

        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| {
                chrono::DateTime::from_timestamp(d.as_secs() as i64, d.subsec_nanos())
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_default()
            });

        let created = metadata
            .created()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| {
                chrono::DateTime::from_timestamp(d.as_secs() as i64, d.subsec_nanos())
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_default()
            });

        let extension = if is_directory {
            None
        } else {
            entry_path
                .extension()
                .map(|e| e.to_string_lossy().to_string())
        };

        #[cfg(unix)]
        let permissions = Some(format_unix_permissions(metadata.permissions().mode()));
        #[cfg(not(unix))]
        let permissions = None;

        entries.push(FileEntry {
            name,
            path: path_str,
            is_directory,
            is_symlink,
            size,
            modified,
            created,
            extension,
            permissions,
        });
    }

    entries.sort_by(|a, b| {
        if a.is_directory != b.is_directory {
            return b.is_directory.cmp(&a.is_directory);
        }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });

    Ok(entries)
}

pub fn get_home_directory() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine home directory".to_string())
}

pub fn create_directory(path: &str) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| format!("Failed to create directory: {}", e))
}

pub fn delete_items(paths: Vec<String>) -> Result<(), String> {
    for path_str in &paths {
        let path = Path::new(path_str);
        if path.is_dir() {
            fs::remove_dir_all(path)
                .map_err(|e| format!("Failed to delete directory {}: {}", path_str, e))?;
        } else {
            fs::remove_file(path)
                .map_err(|e| format!("Failed to delete file {}: {}", path_str, e))?;
        }
    }
    Ok(())
}

pub fn rename_item(old_path: &str, new_path: &str) -> Result<(), String> {
    fs::rename(old_path, new_path)
        .map_err(|e| format!("Failed to rename {} to {}: {}", old_path, new_path, e))
}

pub fn copy_items(sources: Vec<String>, dest_dir: &str) -> Result<(), String> {
    let dest_path = Path::new(dest_dir);
    if !dest_path.is_dir() {
        return Err(format!("Destination is not a directory: {}", dest_dir));
    }

    for source_str in &sources {
        let source = Path::new(source_str);
        let file_name = source
            .file_name()
            .ok_or_else(|| format!("Invalid source path: {}", source_str))?;
        let dest = dest_path.join(file_name);

        if source.is_dir() {
            copy_dir_recursive(source, &dest)?;
        } else {
            fs::copy(source, &dest)
                .map_err(|e| format!("Failed to copy {} to {}: {}", source_str, dest.display(), e))?;
        }
    }
    Ok(())
}

pub fn move_items(sources: Vec<String>, dest_dir: &str) -> Result<(), String> {
    let dest_path = Path::new(dest_dir);
    if !dest_path.is_dir() {
        return Err(format!("Destination is not a directory: {}", dest_dir));
    }

    for source_str in &sources {
        let source = Path::new(source_str);
        let file_name = source
            .file_name()
            .ok_or_else(|| format!("Invalid source path: {}", source_str))?;
        let dest = dest_path.join(file_name);

        if fs::rename(source, &dest).is_err() {
            if source.is_dir() {
                copy_dir_recursive(source, &dest)?;
                fs::remove_dir_all(source)
                    .map_err(|e| format!("Failed to remove source after move: {}", e))?;
            } else {
                fs::copy(source, &dest).map_err(|e| format!("Failed to copy for move: {}", e))?;
                fs::remove_file(source)
                    .map_err(|e| format!("Failed to remove source after move: {}", e))?;
            }
        }
    }
    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("Failed to create directory {}: {}", dst.display(), e))?;

    for entry in fs::read_dir(src).map_err(|e| format!("Failed to read directory: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let entry_dst = dst.join(entry.file_name());

        if entry.file_type().map_err(|e| format!("Failed to get type: {}", e))?.is_dir() {
            copy_dir_recursive(&entry.path(), &entry_dst)?;
        } else {
            fs::copy(entry.path(), &entry_dst)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }
    Ok(())
}

pub fn read_file_text(path: &str, _encoding: Option<String>) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))
}

pub fn get_drives() -> Result<Vec<DriveInfo>, String> {
    let mut drives = Vec::new();

    #[cfg(target_os = "linux")]
    {
        if let Ok(content) = fs::read_to_string("/proc/mounts") {
            for line in content.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let mount_point = parts[1];
                    if mount_point == "/"
                        || mount_point.starts_with("/home")
                        || mount_point.starts_with("/media")
                        || mount_point.starts_with("/mnt")
                    {
                        drives.push(DriveInfo {
                            name: parts[0].to_string(),
                            mount_point: mount_point.to_string(),
                            total_space: None,
                            available_space: None,
                        });
                    }
                }
            }
        }
        if drives.is_empty() {
            drives.push(DriveInfo {
                name: "/".to_string(),
                mount_point: "/".to_string(),
                total_space: None,
                available_space: None,
            });
        }
    }

    #[cfg(target_os = "windows")]
    {
        for letter in b'A'..=b'Z' {
            let drive = format!("{}:\\", letter as char);
            if Path::new(&drive).exists() {
                drives.push(DriveInfo {
                    name: format!("{}:", letter as char),
                    mount_point: drive,
                    total_space: None,
                    available_space: None,
                });
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        drives.push(DriveInfo {
            name: "Macintosh HD".to_string(),
            mount_point: "/".to_string(),
            total_space: None,
            available_space: None,
        });
        if let Ok(volumes) = fs::read_dir("/Volumes") {
            for entry in volumes.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name != "Macintosh HD" {
                    drives.push(DriveInfo {
                        name,
                        mount_point: entry.path().to_string_lossy().to_string(),
                        total_space: None,
                        available_space: None,
                    });
                }
            }
        }
    }

    Ok(drives)
}

#[cfg(unix)]
fn format_unix_permissions(mode: u32) -> String {
    let mut perms = String::with_capacity(9);
    let flags = [
        (0o400, 'r'), (0o200, 'w'), (0o100, 'x'),
        (0o040, 'r'), (0o020, 'w'), (0o010, 'x'),
        (0o004, 'r'), (0o002, 'w'), (0o001, 'x'),
    ];
    for (mask, ch) in flags {
        perms.push(if mode & mask != 0 { ch } else { '-' });
    }
    perms
}

pub fn search_files(start_path: &str, pattern: &str) -> Result<Vec<FileEntry>, String> {
    let path = Path::new(start_path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", start_path));
    }

    let pattern_lower = pattern.to_lowercase();
    let is_glob = pattern.contains('*') || pattern.contains('?');
    let mut results = Vec::new();
    const MAX_RESULTS: usize = 500;

    for entry in WalkDir::new(path)
        .min_depth(1)
        .max_depth(10)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let name = entry.file_name().to_string_lossy().to_lowercase();
        let matches = if is_glob {
            glob_match(&pattern_lower, &name)
        } else {
            name.contains(&pattern_lower)
        };

        if matches {
            let entry_path = entry.path();
            if let Ok(meta) = entry.metadata() {
                let file_entry = build_file_entry_from_path(entry_path, &meta);
                results.push(file_entry);
                if results.len() >= MAX_RESULTS {
                    break;
                }
            }
        }
    }

    Ok(results)
}

fn glob_match(pattern: &str, name: &str) -> bool {
    let pat_chars: Vec<char> = pattern.chars().collect();
    let name_chars: Vec<char> = name.chars().collect();
    glob_match_rec(&pat_chars, 0, &name_chars, 0)
}

fn glob_match_rec(pat: &[char], pi: usize, name: &[char], ni: usize) -> bool {
    if pi == pat.len() {
        return ni == name.len();
    }
    match pat[pi] {
        '*' => {
            for i in ni..=name.len() {
                if glob_match_rec(pat, pi + 1, name, i) {
                    return true;
                }
            }
            false
        }
        '?' => {
            if ni < name.len() {
                glob_match_rec(pat, pi + 1, name, ni + 1)
            } else {
                false
            }
        }
        c => {
            if ni < name.len() && name[ni] == c {
                glob_match_rec(pat, pi + 1, name, ni + 1)
            } else {
                false
            }
        }
    }
}

fn build_file_entry_from_path(path: &Path, meta: &fs::Metadata) -> FileEntry {
    let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
    let is_directory = meta.is_dir();
    let extension = if is_directory {
        None
    } else {
        path.extension().map(|e| e.to_string_lossy().to_string())
    };
    let size = if is_directory { 0 } else { meta.len() };
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| {
            chrono::DateTime::from_timestamp(d.as_secs() as i64, d.subsec_nanos())
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default()
        });
    let created = meta
        .created()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| {
            chrono::DateTime::from_timestamp(d.as_secs() as i64, d.subsec_nanos())
                .map(|dt| dt.to_rfc3339())
                .unwrap_or_default()
        });

    #[cfg(unix)]
    let permissions = Some(format_unix_permissions(meta.permissions().mode()));
    #[cfg(not(unix))]
    let permissions = None;

    FileEntry {
        name,
        path: path.to_string_lossy().to_string(),
        is_directory,
        is_symlink: meta.is_symlink(),
        size,
        modified,
        created,
        extension,
        permissions,
    }
}
