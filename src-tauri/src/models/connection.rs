use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub id: String,
    pub name: String,
    pub protocol: Protocol,
    pub host: String,
    pub port: u16,
    pub username: String,
    #[serde(skip_serializing)]
    pub password: Option<String>,
    pub remote_path: String,
    pub use_key_auth: bool,
    pub key_path: Option<String>,
    pub use_passive: bool,
    pub use_ftps: bool,
    #[serde(default)]
    pub allow_invalid_certs: bool,
    /// SHA-256 fingerprint (hex with `:` separators) of the only certificate
    /// that should be accepted. When set, takes precedence over
    /// `allow_invalid_certs`.
    #[serde(default)]
    pub pinned_cert_sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Protocol {
    Ftp,
    Sftp,
}

impl Default for Connection {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: String::new(),
            protocol: Protocol::Ftp,
            host: String::new(),
            port: 21,
            username: String::from("anonymous"),
            password: None,
            remote_path: String::from("/"),
            use_key_auth: false,
            key_path: None,
            use_passive: true,
            use_ftps: false,
            allow_invalid_certs: false,
            pinned_cert_sha256: None,
        }
    }
}
