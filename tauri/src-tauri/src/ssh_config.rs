use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConfigEntry {
    pub alias: String,
    pub hostname: Option<String>,
    pub port: u16,
    pub user: Option<String>,
    pub identity_file: Option<String>,
    pub proxy_jump: Option<String>,
    pub forward_agent: bool,
    pub extra: HashMap<String, String>,
}

impl Default for SshConfigEntry {
    fn default() -> Self {
        Self {
            alias: String::new(),
            hostname: None,
            port: 22,
            user: None,
            identity_file: None,
            proxy_jump: None,
            forward_agent: false,
            extra: HashMap::new(),
        }
    }
}

pub fn parse_ssh_config() -> Vec<SshConfigEntry> {
    let config_path = get_ssh_config_path();
    if !config_path.exists() {
        return Vec::new();
    }

    let content = match fs::read_to_string(&config_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };

    parse_ssh_config_content(&content)
}

fn parse_ssh_config_content(content: &str) -> Vec<SshConfigEntry> {
    let mut entries = Vec::new();
    let mut current: Option<SshConfigEntry> = None;

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.is_empty() || trimmed.starts_with('#') {
            if let Some(entry) = current.take() {
                entries.push(entry);
            }
            continue;
        }

        let parts: Vec<&str> = trimmed.splitn(2, |c: char| c.is_whitespace()).collect();
        if parts.len() < 2 {
            continue;
        }

        let key = parts[0].to_lowercase();
        let value = parts[1].trim();

        match key.as_str() {
            "host" => {
                if let Some(entry) = current.take() {
                    entries.push(entry);
                }
                current = Some(SshConfigEntry {
                    alias: value.to_string(),
                    ..Default::default()
                });
            }
            "hostname" => {
                if let Some(ref mut entry) = current {
                    entry.hostname = Some(value.to_string());
                }
            }
            "port" => {
                if let Some(ref mut entry) = current {
                    if let Ok(port) = value.parse() {
                        entry.port = port;
                    }
                }
            }
            "user" | "username" => {
                if let Some(ref mut entry) = current {
                    entry.user = Some(value.to_string());
                }
            }
            "identityfile" => {
                if let Some(ref mut entry) = current {
                    entry.identity_file = Some(value.to_string());
                }
            }
            "proxyjump" => {
                if let Some(ref mut entry) = current {
                    entry.proxy_jump = Some(value.to_string());
                }
            }
            "forwardagent" => {
                if let Some(ref mut entry) = current {
                    entry.forward_agent = value == "yes" || value == "true";
                }
            }
            _ => {
                if let Some(ref mut entry) = current {
                    entry.extra.insert(key, value.to_string());
                }
            }
        }
    }

    if let Some(entry) = current {
        entries.push(entry);
    }

    entries
}

fn get_ssh_config_path() -> PathBuf {
    if let Some(home) = dirs::home_dir() {
        home.join(".ssh").join("config")
    } else {
        PathBuf::from("/dev/null")
    }
}

#[tauri::command]
pub fn ssh_config_parse() -> Result<Vec<SshConfigEntry>, String> {
    Ok(parse_ssh_config())
}

#[tauri::command]
pub fn ssh_config_resolve(alias: String) -> Result<SshConfigEntry, String> {
    let entries = parse_ssh_config();
    entries
        .into_iter()
        .find(|e| e.alias == alias || e.alias == "*")
        .ok_or_else(|| format!("Host '{}' not found in SSH config", alias))
}
