use serde::Serialize;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::Duration;

/// Control flags for one in-flight transfer. Both flags are shared
/// (Arc) so worker code can poll them without holding any lock.
#[derive(Clone)]
pub struct TransferControl {
    pub cancelled: Arc<AtomicBool>,
    pub paused: Arc<AtomicBool>,
}

static REGISTRY: OnceLock<Mutex<HashMap<String, TransferControl>>> = OnceLock::new();

fn registry() -> &'static Mutex<HashMap<String, TransferControl>> {
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn register(transfer_id: &str) -> TransferControl {
    let ctl = TransferControl {
        cancelled: Arc::new(AtomicBool::new(false)),
        paused: Arc::new(AtomicBool::new(false)),
    };
    registry()
        .lock()
        .unwrap()
        .insert(transfer_id.to_string(), ctl.clone());
    ctl
}

pub fn unregister(transfer_id: &str) {
    registry().lock().unwrap().remove(transfer_id);
}

/// Sleep while the paused flag is set, returning early if the transfer
/// is cancelled. Returns `true` if the transfer should abort.
pub fn wait_while_paused(ctl: &TransferControl) -> bool {
    while ctl.paused.load(Ordering::SeqCst) {
        if ctl.cancelled.load(Ordering::SeqCst) {
            return true;
        }
        thread::sleep(Duration::from_millis(150));
    }
    ctl.cancelled.load(Ordering::SeqCst)
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TransferProgress {
    pub transfer_id: String,
    pub kind: String,
    pub current_file: String,
    pub file_bytes: u64,
    pub file_total: u64,
    pub items_done: usize,
    pub items_total: usize,
    pub bytes_done: u64,
    pub bytes_total: u64,
    pub status: String, // running | paused | cancelled | done | error
    pub message: Option<String>,
}

#[tauri::command]
pub fn transfer_cancel(transfer_id: String) -> Result<(), String> {
    if let Some(ctl) = registry().lock().unwrap().get(&transfer_id) {
        ctl.cancelled.store(true, Ordering::SeqCst);
    }
    Ok(())
}

#[tauri::command]
pub fn transfer_set_paused(transfer_id: String, paused: bool) -> Result<(), String> {
    if let Some(ctl) = registry().lock().unwrap().get(&transfer_id) {
        ctl.paused.store(paused, Ordering::SeqCst);
    }
    Ok(())
}

/// Custom error used by recursive copy helpers to signal user-initiated
/// cancellation (so callers can distinguish from real failures).
pub const CANCELLED_MSG: &str = "__TRANSFER_CANCELLED__";
