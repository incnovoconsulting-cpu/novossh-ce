# NovoSSH Network Client

A standalone networking client that connects your machine to the NovoSSH network via Headscale/WireGuard. Once installed, your machine gets a Tailscale IP (100.x.x.x) that can be used to SSH into it remotely through NovoSSH — no port forwarding or VPN setup required.

## What It Does

1. Installs and configures Tailscale to connect to the NovoSSH Headscale server
2. Registers your machine on the NovoSSH network
3. Assigns a persistent Tailscale IP (100.x.x.x)
4. Runs as a background service for automatic reconnection

## Install

### macOS / Linux (one-liner)

```bash
curl -fsSL https://novossh.com/network/install.sh | sudo sh -s -- --authkey <your-key>
```

### Windows (PowerShell as Administrator)

```powershell
irm https://novossh.com/network/install-windows.ps1 | iex
```

### Get Your Auth Key

1. Open NovoSSH dashboard
2. Go to Settings → Network
3. Click "Generate Network Key"
4. Copy the key and use it in the installer

## Usage

```bash
# Connect to network
novossh-network --authkey <key>

# Check status
novossh-network --status

# Disconnect
novossh-network --logout

# Shut down Tailscale
novossh-network --down
```

## How It Works

```
Your Machine                     NovoSSH Network
    |                                  |
    |-- novossh-network install -->    |
    |-- tailscale login --authkey -->  |  (Headscale)
    |                                  |
    |<-- assigned 100.x.x.x IP -----  |
    |                                  |
    |-- WireGuard tunnel ----------->  |  (P2P to any peer)
    |                                  |
    |<-- SSH connection via 100.x.x --|  (NovoSSH client)
```

## Architecture

The Network Client is a thin wrapper around Tailscale that:

1. Configures Tailscale to use the NovoSSH Headscale server (`ssh.novossh.com:8080`)
2. Authenticates using a pre-auth key generated from the NovoSSH dashboard
3. Runs Tailscale as a background service
4. Provides a simple CLI interface (`novossh-network`)

## Files

```
network-client/
├── README.md                    # This file
├── scripts/
│   ├── novossh-network.sh       # Main wrapper script
│   └── novossh-network.service  # systemd service file
└── installers/
    ├── install-linux.sh         # Linux installer (curl | sudo sh)
    ├── install-macos.sh         # macOS installer
    └── install-windows.ps1      # Windows PowerShell installer
```
