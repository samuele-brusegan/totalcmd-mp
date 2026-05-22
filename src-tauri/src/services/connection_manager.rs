use crate::models::Connection;
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

pub fn store_password(connection_id: &str, password: &str) -> Result<(), String> {
    let service = "totalcmd-mp";
    let entry = keyring::Entry::new(service, connection_id)
        .map_err(|e| format!("Keyring entry failed: {}", e))?;
    entry.set_password(password)
        .map_err(|e| format!("Keyring store failed: {}", e))
}

pub fn get_password(connection_id: &str) -> Result<Option<String>, String> {
    let service = "totalcmd-mp";
    let entry = keyring::Entry::new(service, connection_id)
        .map_err(|e| format!("Keyring entry failed: {}", e))?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Keyring get failed: {}", e)),
    }
}

pub fn delete_password(connection_id: &str) -> Result<(), String> {
    let service = "totalcmd-mp";
    let entry = keyring::Entry::new(service, connection_id)
        .map_err(|e| format!("Keyring entry failed: {}", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Keyring delete failed: {}", e)),
    }
}
