use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedSession {
    pub id: String,
    pub alias: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub last_connected: String,
    pub tab_title: Option<String>,
}

fn get_sessions_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("novossh")
        .join("sessions.json")
}

pub fn load_sessions() -> Vec<SavedSession> {
    let path = get_sessions_path();
    if !path.exists() {
        return Vec::new();
    }
    let data = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&data).unwrap_or_default()
}

pub fn save_sessions(sessions: &[SavedSession]) -> Result<(), String> {
    let path = get_sessions_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_string_pretty(sessions).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn add_session(session: SavedSession) -> Result<(), String> {
    let mut sessions = load_sessions();
    sessions.retain(|s| s.id != session.id);
    sessions.insert(0, session);
    sessions.truncate(50);
    save_sessions(&sessions)
}

pub fn remove_session(id: &str) -> Result<(), String> {
    let mut sessions = load_sessions();
    sessions.retain(|s| s.id != id);
    save_sessions(&sessions)
}

#[tauri::command]
pub fn session_store_list() -> Vec<SavedSession> {
    load_sessions()
}

#[tauri::command]
pub fn session_store_add(session: SavedSession) -> Result<(), String> {
    add_session(session)
}

#[tauri::command]
pub fn session_store_remove(id: String) -> Result<(), String> {
    remove_session(&id)
}
