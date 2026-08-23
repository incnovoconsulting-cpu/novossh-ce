use ssh2::Session;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::Path;
use tauri::State;

use crate::ssh::session::SshManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SftpFile {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
    pub permissions: String,
    pub modified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SftpTransfer {
    pub id: String,
    pub filename: String,
    pub progress: f64,
    pub total: u64,
    pub transferred: u64,
    pub completed: bool,
}

pub fn list_directory(session: &Session, path: &str) -> Result<Vec<SftpFile>, String> {
    let sftp = session.sftp().map_err(|e| e.to_string())?;
    let entries = sftp.readdir(Path::new(path)).map_err(|e| e.to_string())?;

    let mut files: Vec<SftpFile> = Vec::new();
    for (path, stat) in entries {
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        files.push(SftpFile {
            name,
            is_dir: stat.is_dir(),
            size: stat.size.unwrap_or(0),
            permissions: format!("{:o}", stat.perm.unwrap_or(0)),
            modified: stat.mtime.unwrap_or(0).to_string(),
        });
    }

    files.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    Ok(files)
}

pub fn download_file(session: &Session, remote_path: &str, local_path: &str) -> Result<(), String> {
    let sftp = session.sftp().map_err(|e| e.to_string())?;
    let mut remote_file = sftp.open(Path::new(remote_path)).map_err(|e| e.to_string())?;
    let mut content = Vec::new();
    remote_file
        .read_to_end(&mut content)
        .map_err(|e| e.to_string())?;
    fs::write(local_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn upload_file(session: &Session, local_path: &str, remote_path: &str) -> Result<(), String> {
    let sftp = session.sftp().map_err(|e| e.to_string())?;
    let content = fs::read(local_path).map_err(|e| e.to_string())?;
    let mut remote_file = sftp
        .create(Path::new(remote_path))
        .map_err(|e| e.to_string())?;
    std::io::Write::write_all(&mut remote_file, &content).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn create_directory(session: &Session, path: &str) -> Result<(), String> {
    let sftp = session.sftp().map_err(|e| e.to_string())?;
    sftp.mkdir(Path::new(path), 0o755)
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn delete_file(session: &Session, path: &str) -> Result<(), String> {
    let sftp = session.sftp().map_err(|e| e.to_string())?;
    let stat = sftp.stat(Path::new(path)).map_err(|e| e.to_string())?;
    if stat.is_dir() {
        sftp.rmdir(Path::new(path))
            .map_err(|e| e.to_string())?;
    } else {
        sftp.unlink(Path::new(path))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn rename(session: &Session, old_path: &str, new_path: &str) -> Result<(), String> {
    let sftp = session.sftp().map_err(|e| e.to_string())?;
    sftp.rename(Path::new(old_path), Path::new(new_path), None)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn sftp_list(
    session_id: String,
    path: String,
    state: State<'_, SshManager>,
) -> Result<Vec<SftpFile>, String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or("Session not found")?;
    list_directory(session, &path)
}

#[tauri::command]
pub fn sftp_download(
    session_id: String,
    remote_path: String,
    local_path: String,
    state: State<'_, SshManager>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or("Session not found")?;
    download_file(session, &remote_path, &local_path)
}

#[tauri::command]
pub fn sftp_upload(
    session_id: String,
    local_path: String,
    remote_path: String,
    state: State<'_, SshManager>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or("Session not found")?;
    upload_file(session, &local_path, &remote_path)
}

#[tauri::command]
pub fn sftp_mkdir(
    session_id: String,
    path: String,
    state: State<'_, SshManager>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or("Session not found")?;
    create_directory(session, &path)
}

#[tauri::command]
pub fn sftp_delete(
    session_id: String,
    path: String,
    state: State<'_, SshManager>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or("Session not found")?;
    delete_file(session, &path)
}

#[tauri::command]
pub fn sftp_rename(
    session_id: String,
    old_path: String,
    new_path: String,
    state: State<'_, SshManager>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or("Session not found")?;
    rename(session, &old_path, &new_path)
}
