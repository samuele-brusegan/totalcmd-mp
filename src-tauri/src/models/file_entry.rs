use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub is_symlink: bool,
    pub size: u64,
    pub modified: Option<String>,
    pub created: Option<String>,
    pub extension: Option<String>,
    #[cfg(unix)]
    pub permissions: Option<String>,
    #[cfg(not(unix))]
    pub permissions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    pub name: String,
    pub mount_point: String,
    pub total_space: Option<u64>,
    pub available_space: Option<u64>,
}
