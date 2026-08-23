use std::collections::HashMap;
use std::sync::{Arc, Mutex, mpsc};
use ssh2::Session;
use std::net::TcpStream;
use std::io::{Read, Write};
use anyhow::Result;
use tauri::State;

use super::{SshConfig, SshSession, AuthType};

pub struct SshManager {
    pub sessions: Mutex<HashMap<String, Session>>,
    pub shell_readers: Mutex<HashMap<String, mpsc::Receiver<Vec<u8>>>>,
    pub shell_writers: Mutex<HashMap<String, mpsc::Sender<Vec<u8>>>>,
}

impl SshManager {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
            shell_readers: Mutex::new(HashMap::new()),
            shell_writers: Mutex::new(HashMap::new()),
        }
    }

    pub fn connect(&self, config: SshConfig) -> Result<SshSession> {
        let addr = format!("{}:{}", config.host, config.port);
        let tcp = TcpStream::connect(&addr)?;
        tcp.set_read_timeout(None)?;

        let mut session = Session::new()?;
        session.set_tcp_stream(tcp);
        session.handshake()?;

        match config.auth_type {
            AuthType::Password => {
                if let Some(password) = &config.password {
                    session.userauth_password(&config.username, password)?;
                }
            }
            AuthType::Key => {
                if let Some(key_path) = &config.key_path {
                    session.userauth_pubkey_file(&config.username, None, std::path::Path::new(key_path), None)?;
                }
            }
        }

        let session_id = uuid::Uuid::new_v4().to_string();

        let mut sessions = self.sessions.lock().unwrap();
        sessions.insert(session_id.clone(), session);

        Ok(SshSession {
            id: session_id,
            host: config.host,
            port: config.port,
            username: config.username,
            connected: true,
        })
    }

    pub fn execute(&self, session_id: &str, command: &str) -> Result<String> {
        let sessions = self.sessions.lock().unwrap();
        let session = sessions.get(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found"))?;

        let mut channel = session.channel_session()?;
        channel.exec(command)?;

        let mut output = String::new();
        channel.read_to_string(&mut output)?;
        channel.wait_close()?;

        Ok(output)
    }

    pub fn open_shell(&self, session_id: &str) -> Result<()> {
        let mut sessions = self.sessions.lock().unwrap();
        let session = sessions.get(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found"))?;

        let mut channel = session.channel_session()?;
        channel.request_pty("xterm-256color", None, Some((80, 24, 0, 0)))?;
        channel.shell()?;

        let stream = channel.stream(0);
        let (tx, rx) = mpsc::channel();

        // Spawn a reader thread that reads from the SSH channel
        let session_id_clone = session_id.to_string();
        std::thread::spawn(move || {
            let mut stream = stream;
            loop {
                let mut buf = [0u8; 4096];
                match stream.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = buf[..n].to_vec();
                        if tx.send(data).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        let mut readers = self.shell_readers.lock().unwrap();
        readers.insert(session_id.to_string(), rx);

        Ok(())
    }

    pub fn read_output(&self, session_id: &str) -> Result<String> {
        let readers = self.shell_readers.lock().unwrap();
        let rx = readers.get(session_id)
            .ok_or_else(|| anyhow::anyhow!("Shell not found"))?;

        match rx.try_recv() {
            Ok(data) => Ok(String::from_utf8_lossy(&data).to_string()),
            Err(mpsc::TryRecvError::Empty) => Ok(String::new()),
            Err(mpsc::TryRecvError::Disconnected) => Ok(String::new()),
        }
    }

    pub fn write_input(&self, session_id: &str, data: &str) -> Result<()> {
        // For writing, we need to access the session and create a channel
        // This is a simplified approach - in production you'd want a proper write channel
        let sessions = self.sessions.lock().unwrap();
        let session = sessions.get(session_id)
            .ok_or_else(|| anyhow::anyhow!("Session not found"))?;

        let mut channel = session.channel_session()?;
        channel.write_all(data.as_bytes())?;
        channel.flush()?;

        Ok(())
    }

    pub fn resize(&self, _session_id: &str, _cols: u32, _rows: u32) -> Result<()> {
        // PTY resize requires a different approach - would need to store the channel
        // For now, this is a no-op
        Ok(())
    }

    pub fn disconnect(&self, session_id: &str) {
        let mut readers = self.shell_readers.lock().unwrap();
        readers.remove(session_id);

        let mut writers = self.shell_writers.lock().unwrap();
        writers.remove(session_id);

        let mut sessions = self.sessions.lock().unwrap();
        sessions.remove(session_id);
    }
}

#[tauri::command]
pub fn ssh_connect(
    config: SshConfig,
    state: State<'_, SshManager>,
) -> Result<SshSession, String> {
    state.connect(config).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ssh_execute(
    session_id: String,
    command: String,
    state: State<'_, SshManager>,
) -> Result<String, String> {
    state.execute(&session_id, &command).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ssh_disconnect(
    session_id: String,
    state: State<'_, SshManager>,
) -> Result<(), String> {
    state.disconnect(&session_id);
    Ok(())
}

#[tauri::command]
pub fn ssh_list_sessions(
    state: State<'_, SshManager>,
) -> Result<Vec<SshSession>, String> {
    let sessions = state.sessions.lock().unwrap();
    Ok(sessions.keys().map(|id| SshSession {
        id: id.clone(),
        host: String::new(),
        port: 22,
        username: String::new(),
        connected: true,
    }).collect())
}

#[tauri::command]
pub fn ssh_open_shell(
    session_id: String,
    state: State<'_, SshManager>,
) -> Result<(), String> {
    state.open_shell(&session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ssh_read_output(
    session_id: String,
    state: State<'_, SshManager>,
) -> Result<String, String> {
    state.read_output(&session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ssh_write_input(
    session_id: String,
    data: String,
    state: State<'_, SshManager>,
) -> Result<(), String> {
    state.write_input(&session_id, &data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn ssh_resize(
    session_id: String,
    cols: u32,
    rows: u32,
    state: State<'_, SshManager>,
) -> Result<(), String> {
    state.resize(&session_id, cols, rows).map_err(|e| e.to_string())
}
