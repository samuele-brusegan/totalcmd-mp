use crate::models::Connection;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

static CONNECTIONS: Mutex<Option<Vec<Connection>>> = Mutex::new(None);

fn get_config_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("totalcmd-mp");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("connections.json")
}

pub fn load_connections() -> Result<Vec<Connection>, String> {
    let mut guard = CONNECTIONS.lock().map_err(|e| e.to_string())?;
    if let Some(ref conns) = *guard {
        return Ok(conns.clone());
    }

    let path = get_config_path();
    let conns = if path.exists() {
        let data = fs::read_to_string(&path)
            .map_err(|e| format!("Failed to read connections: {}", e))?;
        serde_json::from_str(&data)
            .map_err(|e| format!("Failed to parse connections: {}", e))?
    } else {
        Vec::new()
    };

    *guard = Some(conns.clone());
    Ok(conns)
}

pub fn save_connections(connections: &[Connection]) -> Result<(), String> {
    let path = get_config_path();
    let data = serde_json::to_string_pretty(connections)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    fs::write(&path, data)
        .map_err(|e| format!("Failed to write connections: {}", e))?;

    let mut guard = CONNECTIONS.lock().map_err(|e| e.to_string())?;
    *guard = Some(connections.to_vec());
    Ok(())
}

pub fn add_connection(conn: Connection) -> Result<Connection, String> {
    let mut conns = load_connections()?;
    conns.push(conn.clone());
    save_connections(&conns)?;
    Ok(conn)
}

pub fn update_connection(conn: Connection) -> Result<(), String> {
    let mut conns = load_connections()?;
    if let Some(pos) = conns.iter().position(|c| c.id == conn.id) {
        conns[pos] = conn;
        save_connections(&conns)?;
        Ok(())
    } else {
        Err(format!("Connection not found: {}", conn.id))
    }
}

pub fn delete_connection(id: &str) -> Result<(), String> {
    let mut conns = load_connections()?;
    conns.retain(|c| c.id != id);
    save_connections(&conns)?;
    Ok(())
}

pub fn get_connection(id: &str) -> Result<Connection, String> {
    let conns = load_connections()?;
    conns.into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| format!("Connection not found: {}", id))
}

const KEYRING_SERVICE: &str = "totalcmd-mp";

/// Path to the fallback password store. Used when the OS keychain
/// (Secret Service / Keychain / Credential Manager) is unavailable, which is
/// common on headless Linux or systems without gnome-keyring/KWallet running.
fn passwords_file() -> PathBuf {
    let dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("totalcmd-mp");
    fs::create_dir_all(&dir).ok();
    dir.join("passwords.json")
}

fn read_password_file() -> HashMap<String, String> {
    fs::read_to_string(passwords_file())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_password_file(map: &HashMap<String, String>) -> Result<(), String> {
    let path = passwords_file();
    let data = serde_json::to_string(map)
        .map_err(|e| format!("Failed to serialize passwords: {}", e))?;
    fs::write(&path, data).map_err(|e| format!("Failed to write passwords: {}", e))?;
    // Restrict permissions: owner read/write only.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

fn try_keyring_set(connection_id: &str, password: &str) -> bool {
    keyring::Entry::new(KEYRING_SERVICE, connection_id)
        .and_then(|e| e.set_password(password))
        .is_ok()
}

fn try_keyring_get(connection_id: &str) -> Option<String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, connection_id).ok()?;
    match entry.get_password() {
        Ok(pw) => Some(pw),
        Err(_) => None,
    }
}

fn try_keyring_delete(connection_id: &str) {
    if let Ok(entry) = keyring::Entry::new(KEYRING_SERVICE, connection_id) {
        let _ = entry.delete_credential();
    }
}

pub fn store_password(connection_id: &str, password: &str) -> Result<(), String> {
    // Prefer the OS keychain; fall back to file storage if unavailable.
    if try_keyring_set(connection_id, password) {
        // Remove any stale file entry to keep keychain as the single source.
        let mut map = read_password_file();
        if map.remove(connection_id).is_some() {
            let _ = write_password_file(&map);
        }
        return Ok(());
    }
    let mut map = read_password_file();
    map.insert(connection_id.to_string(), password.to_string());
    write_password_file(&map)
}

pub fn get_password(connection_id: &str) -> Result<Option<String>, String> {
    if let Some(pw) = try_keyring_get(connection_id) {
        return Ok(Some(pw));
    }
    Ok(read_password_file().get(connection_id).cloned())
}

pub fn delete_password(connection_id: &str) -> Result<(), String> {
    try_keyring_delete(connection_id);
    let mut map = read_password_file();
    if map.remove(connection_id).is_some() {
        write_password_file(&map)?;
    }
    Ok(())
}
