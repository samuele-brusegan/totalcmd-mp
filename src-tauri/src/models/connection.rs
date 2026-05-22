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
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Protocol {
    Ftp,
    Sftp,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransferItem {
    pub id: String,
    pub source_path: String,
    pub dest_path: String,
    pub file_name: String,
    pub size: u64,
    pub transferred: u64,
    pub status: TransferStatus,
    pub direction: TransferDirection,
    pub connection_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TransferStatus {
    Queued,
    InProgress,
    Completed,
    Failed,
    Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TransferDirection {
    Upload,
    Download,
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
        }
    }
}
