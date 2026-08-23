use ssh2::Session;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::State;

use crate::ssh::session::SshManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortForward {
    pub id: String,
    pub session_id: String,
    pub forward_type: ForwardType,
    pub local_host: String,
    pub local_port: u16,
    pub remote_host: String,
    pub remote_port: u16,
    pub active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ForwardType {
    Local,
    Remote,
    Dynamic,
}

pub struct PortForwardManager {
    forwards: Arc<Mutex<HashMap<String, PortForward>>>,
    shutdowns: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl PortForwardManager {
    pub fn new() -> Self {
        Self {
            forwards: Arc::new(Mutex::new(HashMap::new())),
            shutdowns: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Local forwarding (-L): bind local port, tunnel each connection through SSH to remote_host:remote_port
    pub fn start_local_forward(
        &self,
        session: &Session,
        session_id: &str,
        local_host: &str,
        local_port: u16,
        remote_host: &str,
        remote_port: u16,
    ) -> Result<String, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let addr = format!("{}:{}", local_host, local_port);
        let listener = TcpListener::bind(&addr)
            .map_err(|e| format!("Failed to bind {}: {}", addr, e))?;

        let forward = PortForward {
            id: id.clone(),
            session_id: session_id.to_string(),
            forward_type: ForwardType::Local,
            local_host: local_host.to_string(),
            local_port,
            remote_host: remote_host.to_string(),
            remote_port,
            active: true,
        };

        let shutdown = Arc::new(AtomicBool::new(false));
        self.forwards.lock().unwrap().insert(id.clone(), forward);
        self.shutdowns.lock().unwrap().insert(id.clone(), shutdown.clone());

        let session_handle = Session::clone(session);
        let forwards = self.forwards.clone();
        let shutdowns = self.shutdowns.clone();
        let fwd_id = id.clone();
        let rh = remote_host.to_string();

        thread::spawn(move || {
            listener.set_nonblocking(true).ok();
            while !shutdown.load(Ordering::Relaxed) {
                match listener.accept() {
                    Ok((client_stream, addr)) => {
                        let rh2 = rh.clone();
                        let rp = remote_port;
                        let sess = Session::clone(&session_handle);

                        thread::spawn(move || {
                            match sess.channel_direct_tcpip(&rh2, rp, None) {
                                Ok(mut ssh_channel) => {
                                    let _ = bidirectional_relay(client_stream, &mut ssh_channel);
                                    let _ = ssh_channel.close();
                                    let _ = ssh_channel.wait_close();
                                }
                                Err(e) => {
                                    eprintln!("direct_tcpip failed for {}: {}", addr, e);
                                }
                            }
                        });
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(std::time::Duration::from_millis(50));
                        continue;
                    }
                    Err(e) => {
                        eprintln!("Accept error: {}", e);
                        break;
                    }
                }
            }
            forwards.lock().unwrap().remove(&fwd_id);
            shutdowns.lock().unwrap().remove(&fwd_id);
        });

        Ok(id)
    }

    /// Remote forwarding (-R): SSH server listens, tunnels back to local_host:local_port
    pub fn start_remote_forward(
        &self,
        session: &Session,
        session_id: &str,
        local_host: &str,
        local_port: u16,
        remote_host: &str,
        remote_port: u16,
    ) -> Result<String, String> {
        let id = uuid::Uuid::new_v4().to_string();

        let forward = PortForward {
            id: id.clone(),
            session_id: session_id.to_string(),
            forward_type: ForwardType::Remote,
            local_host: local_host.to_string(),
            local_port,
            remote_host: remote_host.to_string(),
            remote_port,
            active: true,
        };

        let shutdown = Arc::new(AtomicBool::new(false));
        self.forwards.lock().unwrap().insert(id.clone(), forward);
        self.shutdowns.lock().unwrap().insert(id.clone(), shutdown.clone());

        let session_handle = Session::clone(session);
        let forwards = self.forwards.clone();
        let shutdowns = self.shutdowns.clone();
        let fwd_id = id.clone();
        let lh = local_host.to_string();
        let rh = remote_host.to_string();

        thread::spawn(move || {
            // Use ssh2's built-in channel_forward_listen on the server side.
            // The SSH server binds remote_port and tunnels connections back through
            // this SSH channel. For each incoming connection, we connect to the
            // local service and relay.
            let listen_result = session_handle.channel_forward_listen(
                remote_port,
                Some(&rh),
                None,
            );

            match listen_result {
                Ok((mut listener, bound_port)) => {
                    eprintln!("Remote forward listening on {}:{}", rh, bound_port);
                    // accept() is blocking, so we use a poll thread with a timeout.
                    // Since Listener doesn't support non-blocking, we accept in a loop
                    // and check shutdown between accepts.
                    while !shutdown.load(Ordering::Relaxed) {
                        // Set a short timeout-like behavior by checking shutdown periodically
                        // accept() blocks until a connection arrives — we handle this by
                        // spawning a separate accept thread that can be interrupted via shutdown
                        // accept() blocks — handle one connection then check shutdown
                        match listener.accept() {
                            Ok(ssh_channel) => {
                                let local_addr = format!("{}:{}", lh, local_port);
                                thread::spawn(move || {
                                    match TcpStream::connect(&local_addr) {
                                        Ok(mut local_stream) => {
                                            let mut ssh = ssh_channel;
                                            let mut buf = [0u8; 8192];
                                            loop {
                                                match ssh.read(&mut buf) {
                                                    Ok(0) => break,
                                                    Ok(n) => {
                                                        if local_stream.write_all(&buf[..n]).is_err() { break; }
                                                    }
                                                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
                                                    Err(_) => break,
                                                }
                                                local_stream.set_read_timeout(Some(std::time::Duration::from_millis(10))).ok();
                                                match local_stream.read(&mut buf) {
                                                    Ok(0) => break,
                                                    Ok(n) => {
                                                        if ssh.write_all(&buf[..n]).is_err() { break; }
                                                        ssh.flush().ok();
                                                    }
                                                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock
                                                        || e.kind() == std::io::ErrorKind::TimedOut => {}
                                                    Err(_) => break,
                                                }
                                            }
                                            let _ = ssh.close();
                                            let _ = ssh.wait_close();
                                        }
                                        Err(e) => {
                                            eprintln!("Local connect failed: {}", e);
                                        }
                                    }
                                });
                            }
                            Err(e) => {
                                eprintln!("Forward listen accept error: {}", e);
                                break;
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("channel_forward_listen failed: {}", e);
                }
            }

            forwards.lock().unwrap().remove(&fwd_id);
            shutdowns.lock().unwrap().remove(&fwd_id);
        });

        Ok(id)
    }

    /// Dynamic SOCKS5 forwarding (-D): local SOCKS5 proxy that routes through SSH
    pub fn start_dynamic_forward(
        &self,
        session: &Session,
        session_id: &str,
        local_host: &str,
        local_port: u16,
    ) -> Result<String, String> {
        let id = uuid::Uuid::new_v4().to_string();
        let addr = format!("{}:{}", local_host, local_port);
        let listener = TcpListener::bind(&addr)
            .map_err(|e| format!("Failed to bind SOCKS5 proxy on {}: {}", addr, e))?;

        let forward = PortForward {
            id: id.clone(),
            session_id: session_id.to_string(),
            forward_type: ForwardType::Dynamic,
            local_host: local_host.to_string(),
            local_port,
            remote_host: String::new(),
            remote_port: 0,
            active: true,
        };

        let shutdown = Arc::new(AtomicBool::new(false));
        self.forwards.lock().unwrap().insert(id.clone(), forward);
        self.shutdowns.lock().unwrap().insert(id.clone(), shutdown.clone());

        let session_handle = Session::clone(session);
        let forwards = self.forwards.clone();
        let shutdowns = self.shutdowns.clone();
        let fwd_id = id.clone();

        thread::spawn(move || {
            listener.set_nonblocking(true).ok();
            while !shutdown.load(Ordering::Relaxed) {
                match listener.accept() {
                    Ok((client_stream, _addr)) => {
                        let sess = Session::clone(&session_handle);
                        thread::spawn(move || {
                            if let Err(e) = handle_socks5_connection(client_stream, &sess) {
                                eprintln!("SOCKS5 connection error: {}", e);
                            }
                        });
                    }
                    Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                        thread::sleep(std::time::Duration::from_millis(50));
                        continue;
                    }
                    Err(e) => {
                        eprintln!("SOCKS5 accept error: {}", e);
                        break;
                    }
                }
            }
            forwards.lock().unwrap().remove(&fwd_id);
            shutdowns.lock().unwrap().remove(&fwd_id);
        });

        Ok(id)
    }

    pub fn stop_forward(&self, id: &str) -> Result<(), String> {
        if let Some(shutdown) = self.shutdowns.lock().unwrap().remove(id) {
            shutdown.store(true, Ordering::Relaxed);
        }
        self.forwards.lock().unwrap().remove(id);
        Ok(())
    }

    pub fn list_forwards(&self) -> Vec<PortForward> {
        self.forwards.lock().unwrap().values().cloned().collect()
    }
}

/// Bidirectional relay between a TCP stream and an SSH channel
fn bidirectional_relay(
    mut tcp: TcpStream,
    ssh: &mut ssh2::Channel,
) -> std::io::Result<()> {
    let mut buf = [0u8; 8192];
    loop {
        // Check SSH channel first (non-blocking via poll)
        match ssh.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                if tcp.write_all(&buf[..n]).is_err() { break; }
                tcp.flush().ok();
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
            Err(_) => break,
        }

        // Check TCP socket
        tcp.set_read_timeout(Some(std::time::Duration::from_millis(10))).ok();
        match tcp.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => {
                if ssh.write_all(&buf[..n]).is_err() { break; }
                ssh.flush().ok();
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock
                || e.kind() == std::io::ErrorKind::TimedOut => {}
            Err(_) => break,
        }
    }
    Ok(())
}

/// Handle a single SOCKS5 client connection
fn handle_socks5_connection(
    mut client: TcpStream,
    session: &Session,
) -> std::io::Result<()> {
    client.set_read_timeout(Some(std::time::Duration::from_secs(10))).ok();

    // SOCKS5 greeting: version(1) + nmethods(1) + methods(n)
    let mut header = [0u8; 2];
    client.read_exact(&mut header)?;
    if header[0] != 0x05 {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Not SOCKS5"));
    }
    let nmethods = header[1] as usize;
    let mut methods = vec![0u8; nmethods];
    client.read_exact(&mut methods)?;

    // Reply: no authentication required
    client.write_all(&[0x05, 0x00])?;

    // SOCKS5 request: version(1) + cmd(1) + rsv(1) + atyp(1) + addr(var) + port(2)
    let mut req = [0u8; 4];
    client.read_exact(&mut req)?;
    if req[0] != 0x05 {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Bad SOCKS version"));
    }

    let cmd = req[1]; // 0x01 = CONNECT
    let atyp = req[3]; // 0x01 = IPv4, 0x03 = domain, 0x04 = IPv6

    let dest_host = match atyp {
        0x01 => {
            let mut ip = [0u8; 4];
            client.read_exact(&mut ip)?;
            format!("{}.{}.{}.{}", ip[0], ip[1], ip[2], ip[3])
        }
        0x03 => {
            let mut len = [0u8; 1];
            client.read_exact(&mut len)?;
            let mut domain = vec![0u8; len[0] as usize];
            client.read_exact(&mut domain)?;
            String::from_utf8(domain)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?
        }
        0x04 => {
            let mut ip = [0u8; 16];
            client.read_exact(&mut ip)?;
            format!(
                "{:02x}{:02x}:{:02x}{:02x}:{:02x}{:02x}:{:02x}{:02x}:{:02x}{:02x}:{:02x}{:02x}:{:02x}{:02x}:{:02x}{:02x}",
                ip[0], ip[1], ip[2], ip[3], ip[4], ip[5], ip[6], ip[7],
                ip[8], ip[9], ip[10], ip[11], ip[12], ip[13], ip[14], ip[15]
            )
        }
        _ => return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "Unknown address type",
        )),
    };

    let mut port_buf = [0u8; 2];
    client.read_exact(&mut port_buf)?;
    let dest_port = u16::from_be_bytes(port_buf);

    if cmd != 0x01 {
        // Only CONNECT supported
        client.write_all(&[0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0])?;
        return Ok(());
    }

    // Open SSH tunnel to destination
    let mut ssh_channel = session
        .channel_direct_tcpip(&dest_host, dest_port, None)
        .map_err(|e| {
            std::io::Error::new(std::io::ErrorKind::ConnectionRefused, e.to_string())
        })?;

    // Success reply
    client.write_all(&[0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0])?;
    client.set_read_timeout(None).ok();

    // Bidirectional relay
    bidirectional_relay(client, &mut ssh_channel)?;
    let _ = ssh_channel.close();
    let _ = ssh_channel.wait_close();
    Ok(())
}

// ─── Tauri command wrappers ───

#[tauri::command]
pub fn port_forward_local(
    session_id: String,
    local_port: u16,
    remote_host: String,
    remote_port: u16,
    local_host: Option<String>,
    state: State<'_, SshManager>,
    forward_state: State<'_, PortForwardManager>,
) -> Result<String, String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or("Session not found")?;
    let lh = local_host.unwrap_or_else(|| "127.0.0.1".to_string());
    forward_state.start_local_forward(
        session, &session_id, &lh, local_port, &remote_host, remote_port,
    )
}

#[tauri::command]
pub fn port_forward_remote(
    session_id: String,
    local_port: u16,
    remote_host: String,
    remote_port: u16,
    local_host: Option<String>,
    state: State<'_, SshManager>,
    forward_state: State<'_, PortForwardManager>,
) -> Result<String, String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or("Session not found")?;
    let lh = local_host.unwrap_or_else(|| "127.0.0.1".to_string());
    forward_state.start_remote_forward(
        session, &session_id, &lh, local_port, &remote_host, remote_port,
    )
}

#[tauri::command]
pub fn port_forward_dynamic(
    session_id: String,
    local_port: u16,
    local_host: Option<String>,
    state: State<'_, SshManager>,
    forward_state: State<'_, PortForwardManager>,
) -> Result<String, String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get(&session_id)
        .ok_or("Session not found")?;
    let lh = local_host.unwrap_or_else(|| "127.0.0.1".to_string());
    forward_state.start_dynamic_forward(session, &session_id, &lh, local_port)
}

#[tauri::command]
pub fn port_forward_stop(
    forward_id: String,
    state: State<'_, PortForwardManager>,
) -> Result<(), String> {
    state.stop_forward(&forward_id)
}

#[tauri::command]
pub fn port_forward_list(
    state: State<'_, PortForwardManager>,
) -> Vec<PortForward> {
    state.list_forwards()
}
