use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{BufRead, BufReader, Write};
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
pub struct CertInfo {
    pub subject: String,
    pub issuer: String,
    pub not_before: String,
    pub not_after: String,
    pub fingerprint_sha256: String,
    pub serial: String,
    pub sans: Vec<String>,
    pub self_signed: bool,
    pub expired: bool,
    pub hostname_matches: bool,
    pub host_queried: String,
}

fn read_ftp_response<R: BufRead>(reader: &mut R) -> Result<String, String> {
    let mut buf = String::new();
    reader
        .read_line(&mut buf)
        .map_err(|e| format!("FTP read failed: {}", e))?;
    if buf.len() >= 4 && buf.as_bytes()[3] == b'-' {
        let code: String = buf.chars().take(3).collect();
        loop {
            let mut line = String::new();
            reader
                .read_line(&mut line)
                .map_err(|e| format!("FTP read failed: {}", e))?;
            buf.push_str(&line);
            if line.starts_with(&code) && line.as_bytes().get(3) == Some(&b' ') {
                break;
            }
        }
    }
    Ok(buf)
}

fn hostname_matches(host: &str, sans: &[String], cn: Option<&str>) -> bool {
    let host_lc = host.to_ascii_lowercase();

    let check = |pattern: &str| -> bool {
        let p = pattern.trim_start_matches("DNS:").to_ascii_lowercase();
        if let Some(rest) = p.strip_prefix("*.") {
            // Wildcard: only matches a single label
            if let Some(dot) = host_lc.find('.') {
                return &host_lc[dot + 1..] == rest;
            }
            return false;
        }
        p == host_lc
    };

    if sans.iter().any(|s| check(s)) {
        return true;
    }
    if let Some(cn) = cn {
        return check(cn);
    }
    false
}

#[tauri::command]
pub fn inspect_ftps_certificate(
    host: String,
    port: u16,
    implicit: Option<bool>,
) -> Result<CertInfo, String> {
    // Resolve and prefer IPv4 to avoid `EADDRNOTAVAIL` on networks without
    // routable IPv6.
    let raw: Vec<SocketAddr> = (host.as_str(), port)
        .to_socket_addrs()
        .map_err(|e| format!("DNS resolve failed for {}:{}: {}", host, port, e))?
        .collect();
    if raw.is_empty() {
        return Err(format!("No addresses for {}", host));
    }
    let mut addrs: Vec<SocketAddr> =
        raw.iter().filter(|a| a.is_ipv4()).cloned().collect();
    addrs.extend(raw.iter().filter(|a| a.is_ipv6()).cloned());

    let mut tcp_opt: Option<TcpStream> = None;
    let mut last_err: Option<String> = None;
    for addr in &addrs {
        match TcpStream::connect_timeout(addr, Duration::from_secs(10)) {
            Ok(s) => {
                tcp_opt = Some(s);
                break;
            }
            Err(e) => last_err = Some(format!("{} → {}", addr, e)),
        }
    }
    let tcp = tcp_opt.ok_or_else(|| {
        format!(
            "TCP connect failed: {}",
            last_err.unwrap_or_else(|| "no candidates".into())
        )
    })?;
    tcp.set_read_timeout(Some(Duration::from_secs(10))).ok();
    tcp.set_write_timeout(Some(Duration::from_secs(10))).ok();

    let tcp = if implicit.unwrap_or(false) || port == 990 {
        // Implicit FTPS: TLS starts immediately, no AUTH TLS handshake.
        tcp
    } else {
        // Explicit FTPS: read banner, send AUTH TLS, read 234.
        let mut reader = BufReader::new(tcp);
        let _greeting = read_ftp_response(&mut reader)?;

        reader
            .get_mut()
            .write_all(b"AUTH TLS\r\n")
            .map_err(|e| format!("FTP write failed: {}", e))?;
        let resp = read_ftp_response(&mut reader)?;
        let code = resp.chars().take(3).collect::<String>();
        if code != "234" {
            return Err(format!("Server rejected AUTH TLS: {}", resp.trim()));
        }

        if !reader.buffer().is_empty() {
            return Err("Unexpected data buffered before TLS handshake".into());
        }
        reader
            .into_inner()
            .try_clone()
            .map_err(|e| format!("Socket clone failed: {}", e))?
    };

    let connector = native_tls::TlsConnector::builder()
        .danger_accept_invalid_certs(true)
        .danger_accept_invalid_hostnames(true)
        .build()
        .map_err(|e| format!("TLS setup failed: {}", e))?;

    let tls = connector
        .connect(&host, tcp)
        .map_err(|e| format!("TLS handshake failed: {}", e))?;

    let cert = tls
        .peer_certificate()
        .map_err(|e| format!("Failed to read peer certificate: {}", e))?
        .ok_or_else(|| "Server did not present a certificate".to_string())?;

    let der = cert
        .to_der()
        .map_err(|e| format!("Failed to encode certificate: {}", e))?;

    parse_cert_info(&der, &host)
}

fn parse_cert_info(der: &[u8], host: &str) -> Result<CertInfo, String> {
    use x509_parser::prelude::*;

    let (_, cert) = X509Certificate::from_der(der)
        .map_err(|e| format!("X.509 parse error: {}", e))?;

    let subject = cert.subject().to_string();
    let issuer = cert.issuer().to_string();

    let not_before = cert.validity().not_before.to_rfc2822().unwrap_or_else(|_| {
        cert.validity().not_before.timestamp().to_string()
    });
    let not_after = cert.validity().not_after.to_rfc2822().unwrap_or_else(|_| {
        cert.validity().not_after.timestamp().to_string()
    });

    let expired = !cert.validity().is_valid();

    let serial = format!("{:X}", cert.serial);

    let mut hasher = Sha256::new();
    hasher.update(der);
    let fp = hasher.finalize();
    let fingerprint_sha256 = fp
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(":");

    let mut sans: Vec<String> = Vec::new();
    if let Ok(Some(san_ext)) = cert.subject_alternative_name() {
        for gn in &san_ext.value.general_names {
            sans.push(format!("{}", gn));
        }
    }

    let cn = cert
        .subject()
        .iter_common_name()
        .next()
        .and_then(|cn| cn.as_str().ok())
        .map(|s| s.to_string());

    let hostname_matches = hostname_matches(host, &sans, cn.as_deref());
    let self_signed = subject == issuer;

    Ok(CertInfo {
        subject,
        issuer,
        not_before,
        not_after,
        fingerprint_sha256,
        serial,
        sans,
        self_signed,
        expired,
        hostname_matches,
        host_queried: host.to_string(),
    })
}
