use crate::models::Connection;
use crate::services::connection_manager;

#[tauri::command]
pub fn get_connections() -> Result<Vec<Connection>, String> {
    connection_manager::load_connections()
}

#[tauri::command]
pub fn save_connection(connection: Connection) -> Result<Connection, String> {
    if let Some(ref password) = connection.password {
        if !password.is_empty() {
            connection_manager::store_password(&connection.id, password).ok();
        }
    }
    connection_manager::add_connection(connection)
}

#[tauri::command]
pub fn update_connection(connection: Connection) -> Result<(), String> {
    if let Some(ref password) = connection.password {
        if !password.is_empty() {
            connection_manager::store_password(&connection.id, password).ok();
        }
    }
    connection_manager::update_connection(connection)
}

#[tauri::command]
pub fn delete_connection(id: String) -> Result<(), String> {
    connection_manager::delete_password(&id).ok();
    connection_manager::delete_connection(&id)
}
