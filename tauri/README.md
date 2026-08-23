# NovoSSH Desktop (Tauri)

Native SSH terminal client for Windows, macOS, and Linux built with Tauri v2.

## Architecture

- **Frontend**: React + xterm.js (reuses the web app)
- **Backend**: Rust with `ssh2` crate for direct TCP SSH connections
- **No Electron**: Uses system webview (~5MB vs 150MB)

## Features

- Direct TCP SSH connections (no relay server needed)
- SSH key and password authentication
- Full xterm-256color terminal
- Modern dark theme with custom titlebar
- Cross-platform (Windows, macOS, Linux)

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run tauri:dev
```

## Building

```bash
# Build for current platform
npm run tauri:build

# Build for Windows (cross-compile)
npm run tauri:build:windows
```

## Project Structure

```
tauri/
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs          # Tauri app setup
│   │   └── ssh/
│   │       ├── mod.rs      # SSH types
│   │       └── session.rs  # SSH connection management
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri config
└── README.md
```

## SSH Backend

The Rust backend uses the `ssh2` crate for direct TCP connections:

```rust
// Connect to server
let session = ssh_connect(SshConfig {
    host: "192.168.1.100".to_string(),
    port: 22,
    username: "root".to_string(),
    auth_type: AuthType::Password,
    password: Some("password".to_string()),
    key_path: None,
});

// Execute command
let output = ssh_execute(session.id, "ls -la")?;
```

No WebSocket relay. No server dependency. Direct TCP to any SSH server.
