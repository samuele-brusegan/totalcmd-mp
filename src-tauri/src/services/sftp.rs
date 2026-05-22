use crate::models::{Connection, FileEntry};
use ssh2::Session;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Path;

pub struct SftpClient {
    session: Session,
}

impl SftpClient {
    pub fn connect(conn: &Connection) -> Result<Self, String> {
        let addr = format!("{}:{}", conn.host, conn.port);
        let tcp = TcpStream::connect(&addr)
            .map_err(|e| format!("SFTP TCP connect failed: {}", e))?;

        let mut session = Session::new()
            .map_err(|e| format!("SSH session creation failed: {}", e))?;

        session.set_tcp_stream(tcp);
        session.handshake()
            .map_err(|e| format!("SSH handshake failed: {}", e))?;

        if conn.use_key_auth {
            let key_path = conn.key_path.as_deref().unwrap_or("~/.ssh/id_rsa");
            let expanded = shellexpand::tilde(key_path).to_string();
            let passphrase = conn.password.as_deref();
            session.userauth_pubkey_file(&conn.username, None, Path::new(&expanded), passphrase)
                .map_err(|e| format!("SSH key auth failed: {}", e))?;
        } else if let Some(password) = &conn.password {
            session.userauth_password(&conn.username, password)
                .map_err(|e| format!("SSH password auth failed: {}", e))?;
        } else {
            session.userauth_agent(&conn.username)
                .map_err(|e| format!("SSH agent auth failed: {}", e))?;
        }

        if !session.authenticated() {
            return Err("SFTP authentication failed".to_string());
        }

        Ok(Self { session })
    }

    pub fn list_dir(&self, path: &str) -> Result<Vec<FileEntry>, String> {
        let sftp = self.session.sftp()
            .map_err(|e| format!("SFTP subsystem failed: {}", e))?;

        let dir = sftp.readdir(Path::new(path))
            .map_err(|e| format!("SFTP readdir failed: {}", e))?;

        let mut files: Vec<FileEntry> = Vec::new();
        let parent = if path.ends_with('/') {
            path.to_string()
        } else {
            format!("{}/", path)
        };

        for (entry_path, stat) in dir {
            let name = entry_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            if name == "." || name == ".." {
                continue;
            }

            let is_directory = stat.is_dir();
            let is_symlink = stat.file_type() == ssh2::FileType::Symlink;
            let size = if is_directory { 0 } else { stat.size.unwrap_or(0) };

            let modified = stat.mtime.map(|t| {
                chrono::DateTime::from_timestamp(t as i64, 0)
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_default()
            });

            let permissions = stat.perm.map(|mode| {
                format_sftp_permissions(mode)
            });

            let extension = if is_directory {
                None
            } else {
                entry_path.extension().map(|e| e.to_string_lossy().to_string())
            };

            files.push(FileEntry {
                path: format!("{}{}", parent, name),
                name,
                is_directory,
                is_symlink,
                size,
                modified,
                created: None,
                extension,
                permissions,
            });
        }

        files.sort_by(|a, b| {
            if a.is_directory != b.is_directory {
                return b.is_directory.cmp(&a.is_directory);
            }
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        });

        Ok(files)
    }

    pub fn download_file(&self, remote_path: &str, local_path: &str) -> Result<u64, String> {
        let sftp = self.session.sftp()
            .map_err(|e| format!("SFTP subsystem failed: {}", e))?;

        let mut remote_file = sftp.open(Path::new(remote_path))
            .map_err(|e| format!("SFTP open failed: {}", e))?;

        let local_file_path = Path::new(local_path);
        if let Some(parent) = local_file_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create local dir: {}", e))?;
        }

        let mut file = std::fs::File::create(local_path)
            .map_err(|e| format!("Failed to create local file: {}", e))?;

        let mut total: u64 = 0;
        let mut buf = vec![0u8; 32768];
        loop {
            let n = remote_file.read(&mut buf)
                .map_err(|e| format!("SFTP read error: {}", e))?;
            if n == 0 { break; }
            file.write_all(&buf[..n])
                .map_err(|e| format!("Write error: {}", e))?;
            total += n as u64;
        }

        Ok(total)
    }

    pub fn upload_file(&self, local_path: &str, remote_path: &str) -> Result<u64, String> {
        let sftp = self.session.sftp()
            .map_err(|e| format!("SFTP subsystem failed: {}", e))?;

        let mut local_file = std::fs::File::open(local_path)
            .map_err(|e| format!("Failed to open local file: {}", e))?;
        let size = local_file.metadata()
            .map_err(|e| format!("Failed to read metadata: {}", e))?.len();

        let mut remote_file = sftp.create(Path::new(remote_path))
            .map_err(|e| format!("SFTP create failed: {}", e))?;

        let mut buf = vec![0u8; 32768];
        loop {
            let n = local_file.read(&mut buf)
                .map_err(|e| format!("Local read error: {}", e))?;
            if n == 0 { break; }
            remote_file.write_all(&buf[..n])
                .map_err(|e| format!("SFTP write error: {}", e))?;
        }

        Ok(size)
    }

    pub fn mkdir(&self, path: &str) -> Result<(), String> {
        let sftp = self.session.sftp()
            .map_err(|e| format!("SFTP subsystem failed: {}", e))?;
        sftp.mkdir(Path::new(path), 0o755)
            .map_err(|e| format!("SFTP mkdir failed: {}", e))
    }

    pub fn remove_file(&self, path: &str) -> Result<(), String> {
        let sftp = self.session.sftp()
            .map_err(|e| format!("SFTP subsystem failed: {}", e))?;
        sftp.unlink(Path::new(path))
            .map_err(|e| format!("SFTP rm failed: {}", e))
    }

    pub fn remove_dir(&self, path: &str) -> Result<(), String> {
        let sftp = self.session.sftp()
            .map_err(|e| format!("SFTP subsystem failed: {}", e))?;
        sftp.rmdir(Path::new(path))
            .map_err(|e| format!("SFTP rmdir failed: {}", e))
    }

    pub fn rename(&self, from: &str, to: &str) -> Result<(), String> {
        let sftp = self.session.sftp()
            .map_err(|e| format!("SFTP subsystem failed: {}", e))?;
        sftp.rename(Path::new(from), Path::new(to), None)
            .map_err(|e| format!("SFTP rename failed: {}", e))
    }

    pub fn disconnect(self) -> Result<(), String> {
        self.session.disconnect(None, "bye", None)
            .map_err(|e| format!("SSH disconnect failed: {}", e))
    }
}

fn format_sftp_permissions(mode: u32) -> String {
    let mut perms = String::with_capacity(10);
    perms.push(if mode & 0o40000 != 0 { 'd' } else { '-' });
    let flags: [(u32, char); 9] = [
        (0o400, 'r'), (0o200, 'w'), (0o100, 'x'),
        (0o040, 'r'), (0o020, 'w'), (0o010, 'x'),
        (0o004, 'r'), (0o002, 'w'), (0o001, 'x'),
    ];
    for (mask, ch) in flags {
        perms.push(if mode & mask != 0 { ch } else { '-' });
    }
    perms
}
