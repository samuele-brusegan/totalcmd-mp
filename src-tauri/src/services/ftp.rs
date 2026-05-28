use crate::models::{Connection, FileEntry};
use std::net::{SocketAddr, ToSocketAddrs};
use std::path::Path;
use std::time::Duration;
use suppaftp::types::FileType;
use suppaftp::{FtpStream, NativeTlsConnector, NativeTlsFtpStream};

const IO_TIMEOUT: Duration = Duration::from_secs(30);

/// Resolve `host:port` and return the addresses sorted with IPv4 first.
/// On many networks (mobile, ISP without IPv6 routing) the resolver may
/// return a AAAA record that's unroutable; trying it first leads to
/// `EADDRNOTAVAIL`. By preferring IPv4 we avoid that hang.
fn resolve_prefer_v4(host: &str, port: u16) -> Result<Vec<SocketAddr>, String> {
    let raw: Vec<SocketAddr> = (host, port)
        .to_socket_addrs()
        .map_err(|e| format!("DNS resolve failed for {}:{}: {}", host, port, e))?
        .collect();
    if raw.is_empty() {
        return Err(format!("No addresses for {}", host));
    }
    let mut sorted: Vec<SocketAddr> =
        raw.iter().filter(|a| a.is_ipv4()).cloned().collect();
    sorted.extend(raw.iter().filter(|a| a.is_ipv6()).cloned());
    Ok(sorted)
}

enum FtpInner {
    Plain(FtpStream),
    Tls(NativeTlsFtpStream),
}

pub struct FtpClient {
    inner: FtpInner,
}

macro_rules! with_stream {
    ($self:expr, $name:ident, $body:expr) => {
        match &mut $self.inner {
            FtpInner::Plain($name) => $body,
            FtpInner::Tls($name) => $body,
        }
    };
}

impl FtpClient {
    pub fn connect(conn: &Connection) -> Result<Self, String> {
        let password = conn.password.clone().unwrap_or_default();
        let addrs = resolve_prefer_v4(&conn.host, conn.port)?;

        if conn.use_ftps {
            let pinned = conn
                .pinned_cert_sha256
                .as_deref()
                .map(normalize_fingerprint);

            // When pinning, probe the cert via a separate TLS handshake first
            // and compare against the saved fingerprint. Mismatch ⇒ abort
            // BEFORE the real connection (no credentials sent).
            if let Some(ref expected) = pinned {
                let info = crate::commands::tls_inspect::inspect_ftps_certificate(
                    conn.host.clone(),
                    conn.port,
                    Some(conn.port == 990),
                )?;
                let actual = normalize_fingerprint(&info.fingerprint_sha256);
                if &actual != expected {
                    return Err(format!(
                        "Pinned certificate mismatch.\n\
                         Expected: {}\nActual:   {}\n\n\
                         Il server presenta un certificato diverso da quello \
                         che hai approvato. Rifiuto la connessione.",
                        expected, actual
                    ));
                }
            }

            // Try each candidate address in turn (IPv4 first).
            let stream = {
                let mut last_err: Option<String> = None;
                let mut got: Option<NativeTlsFtpStream> = None;
                for addr in &addrs {
                    match NativeTlsFtpStream::connect(*addr) {
                        Ok(s) => {
                            got = Some(s);
                            break;
                        }
                        Err(e) => {
                            last_err = Some(format!("{} → {}", addr, e));
                        }
                    }
                }
                got.ok_or_else(|| {
                    format!(
                        "FTP connect failed: {}",
                        last_err.unwrap_or_else(|| "no candidates".into())
                    )
                })?
            };
            // Bound any subsequent socket read/write so a stalled data
            // channel (typical of misconfigured active mode) returns an
            // error instead of hanging forever.
            stream
                .get_ref()
                .set_read_timeout(Some(IO_TIMEOUT))
                .map_err(|e| format!("set_read_timeout: {}", e))?;
            stream
                .get_ref()
                .set_write_timeout(Some(IO_TIMEOUT))
                .map_err(|e| format!("set_write_timeout: {}", e))?;
            let mut tls_builder = native_tls::TlsConnector::builder();
            // For pinned and "allow invalid" we skip native verification,
            // since either we already verified via fingerprint (pin) or the
            // user explicitly accepted invalid certs.
            if conn.allow_invalid_certs || pinned.is_some() {
                tls_builder
                    .danger_accept_invalid_certs(true)
                    .danger_accept_invalid_hostnames(true);
            }
            let tls = NativeTlsConnector::from(
                tls_builder
                    .build()
                    .map_err(|e| format!("TLS setup failed: {}", e))?,
            );
            let mut stream = stream
                .into_secure(tls, &conn.host)
                .map_err(|e| format!("FTPS upgrade failed: {}", e))?;

            stream
                .login(&conn.username, &password)
                .map_err(|e| format!("FTP login failed: {}", e))?;

            if conn.use_passive {
                stream.set_mode(suppaftp::Mode::Passive);
            } else {
                stream.set_mode(suppaftp::Mode::Active);
            }

            stream
                .transfer_type(FileType::Binary)
                .map_err(|e| format!("Failed to set binary mode: {}", e))?;

            Ok(Self { inner: FtpInner::Tls(stream) })
        } else {
            let mut stream = {
                let mut last_err: Option<String> = None;
                let mut got: Option<FtpStream> = None;
                for addr in &addrs {
                    match FtpStream::connect(*addr) {
                        Ok(s) => {
                            got = Some(s);
                            break;
                        }
                        Err(e) => {
                            last_err = Some(format!("{} → {}", addr, e));
                        }
                    }
                }
                got.ok_or_else(|| {
                    format!(
                        "FTP connect failed: {}",
                        last_err.unwrap_or_else(|| "no candidates".into())
                    )
                })?
            };
            stream
                .get_ref()
                .set_read_timeout(Some(IO_TIMEOUT))
                .map_err(|e| format!("set_read_timeout: {}", e))?;
            stream
                .get_ref()
                .set_write_timeout(Some(IO_TIMEOUT))
                .map_err(|e| format!("set_write_timeout: {}", e))?;

            stream
                .login(&conn.username, &password)
                .map_err(|e| format!("FTP login failed: {}", e))?;

            if conn.use_passive {
                stream.set_mode(suppaftp::Mode::Passive);
            } else {
                stream.set_mode(suppaftp::Mode::Active);
            }

            stream
                .transfer_type(FileType::Binary)
                .map_err(|e| format!("Failed to set binary mode: {}", e))?;

            Ok(Self { inner: FtpInner::Plain(stream) })
        }
    }

    pub fn list_dir(&mut self, path: &str) -> Result<Vec<FileEntry>, String> {
        let entries = with_stream!(self, s, {
            s.list(Some(path))
                .map_err(|e| format!("FTP list failed: {}", e))?
        });

        let mut files: Vec<FileEntry> = Vec::new();
        for line in entries {
            if let Some(entry) = parse_ftp_list_line(&line, path) {
                if entry.name != "." && entry.name != ".." {
                    files.push(entry);
                }
            }
        }

        files.sort_by(|a, b| {
            if a.is_directory != b.is_directory {
                return b.is_directory.cmp(&a.is_directory);
            }
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        });

        Ok(files)
    }

    pub fn pwd(&mut self) -> Result<String, String> {
        with_stream!(self, s, {
            s.pwd().map_err(|e| format!("FTP pwd failed: {}", e))
        })
    }

    pub fn download_file(&mut self, remote_path: &str, local_path: &str) -> Result<u64, String> {
        let local_file_path = Path::new(local_path);
        if let Some(parent) = local_file_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create local dir: {}", e))?;
        }

        let cursor = with_stream!(self, s, {
            s.retr_as_buffer(remote_path)
                .map_err(|e| format!("FTP download failed: {}", e))?
        });

        let data = cursor.into_inner();
        let total = data.len() as u64;
        std::fs::write(local_path, &data)
            .map_err(|e| format!("Failed to write local file: {}", e))?;

        Ok(total)
    }

    pub fn upload_file(&mut self, local_path: &str, remote_path: &str) -> Result<u64, String> {
        let data = std::fs::read(local_path)
            .map_err(|e| format!("Failed to read local file: {}", e))?;
        let size = data.len() as u64;

        let mut cursor = std::io::Cursor::new(data);
        with_stream!(self, s, {
            s.put_file(remote_path, &mut cursor)
                .map_err(|e| format!("FTP upload failed: {}", e))?
        });

        Ok(size)
    }

    pub fn mkdir(&mut self, path: &str) -> Result<(), String> {
        with_stream!(self, s, {
            s.mkdir(path).map_err(|e| format!("FTP mkdir failed: {}", e))
        })
    }

    pub fn remove_file(&mut self, path: &str) -> Result<(), String> {
        with_stream!(self, s, {
            s.rm(path).map_err(|e| format!("FTP rm failed: {}", e))
        })
    }

    pub fn remove_dir(&mut self, path: &str) -> Result<(), String> {
        with_stream!(self, s, {
            s.rmdir(path).map_err(|e| format!("FTP rmdir failed: {}", e))
        })
    }

    pub fn rename(&mut self, from: &str, to: &str) -> Result<(), String> {
        with_stream!(self, s, {
            s.rename(from, to).map_err(|e| format!("FTP rename failed: {}", e))
        })
    }

    pub fn disconnect(self) -> Result<(), String> {
        match self.inner {
            FtpInner::Plain(mut s) => s.quit().map_err(|e| format!("FTP quit failed: {}", e)),
            FtpInner::Tls(mut s) => s.quit().map_err(|e| format!("FTP quit failed: {}", e)),
        }
    }
}

fn parse_ftp_list_line(line: &str, parent_path: &str) -> Option<FileEntry> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() < 9 {
        return parse_dos_list_line(line, parent_path);
    }

    let permissions_str = parts[0];
    let is_directory = permissions_str.starts_with('d');
    let is_symlink = permissions_str.starts_with('l');
    let size: u64 = parts[4].parse().unwrap_or(0);

    let name_parts = &parts[8..];
    let mut name = name_parts.join(" ");

    if is_symlink {
        if let Some(idx) = name.find(" -> ") {
            name = name[..idx].to_string();
        }
    }

    let parent = if parent_path.ends_with('/') {
        parent_path.to_string()
    } else {
        format!("{}/", parent_path)
    };

    let extension = if is_directory {
        None
    } else {
        Path::new(&name).extension().map(|e| e.to_string_lossy().to_string())
    };

    Some(FileEntry {
        path: format!("{}{}", parent, name),
        name,
        is_directory,
        is_symlink,
        size,
        modified: None,
        created: None,
        extension,
        permissions: Some(permissions_str.to_string()),
    })
}

fn parse_dos_list_line(line: &str, parent_path: &str) -> Option<FileEntry> {
    let is_directory = line.contains("<DIR>");
    let parts: Vec<&str> = line.splitn(4, char::is_whitespace).collect();
    if parts.len() < 4 {
        return None;
    }

    let name = parts.last()?.trim().to_string();
    if name.is_empty() || name == "." || name == ".." {
        return None;
    }

    let size: u64 = if is_directory { 0 } else {
        parts.get(2).and_then(|s| s.replace(',', "").parse().ok()).unwrap_or(0)
    };

    let parent = if parent_path.ends_with('/') {
        parent_path.to_string()
    } else {
        format!("{}/", parent_path)
    };

    let extension = if is_directory {
        None
    } else {
        Path::new(&name).extension().map(|e| e.to_string_lossy().to_string())
    };

    Some(FileEntry {
        path: format!("{}{}", parent, name),
        name,
        is_directory,
        is_symlink: false,
        size,
        modified: None,
        created: None,
        extension,
        permissions: None,
    })
}

fn normalize_fingerprint(fp: &str) -> String {
    fp.chars()
        .filter(|c| c.is_ascii_hexdigit())
        .collect::<String>()
        .to_ascii_uppercase()
}


