# Connecting to Hosts — NovoSSH Guide

## Overview

NovoSSH supports three connection methods to reach your servers. Choose the right one based on your network setup.

---

## Connection Methods

### 1. Tailscale Tunnel (Recommended)

Direct peer-to-peer connection through your Tailscale/Headscale network. No server relay needed.

**Requirements:**
- Host must be registered on the NovoSSH Tailscale network
- Client device must have Tailscale connected (native apps only)

**How to set up:**
1. Add a new host in NovoSSH
2. Set **Connection Mode** to "Tailscale Tunnel"
3. Enter the host's Tailscale IP (format: `100.x.x.x`)
4. Enter port (default: 22), username, and auth method
5. Click Connect

**Finding your host's Tailscale IP:**
- On the host: `tailscale ip -4`
- Or check Headscale: `headscale nodes list`

**Which clients support this?**
| Client | Tailscale Support |
|--------|------------------|
| Desktop (Tauri/Windows) | ✅ Via Network Client installer |
| Desktop (Linux) | ✅ Via Network Client installer |
| macOS / Linux | ✅ Via Network Client installer |
| iOS | ✅ Embedded Tailscale |
| Android | ✅ Embedded Tailscale |
| Web Browser | ❌ Falls back to relay |

**Installing the Network Client:**

```bash
# Linux / macOS (auto-detects OS and architecture)
curl -fsSL https://novossh.com/network/install.sh | sudo sh

# With email/password login
curl -fsSL https://novossh.com/network/install.sh | sudo sh -s -- --email user@novossh.com --password <pass>

# Windows (PowerShell as Administrator)
.\install-windows.ps1 -Email user@novossh.com -Password <pass>
```

The installer automatically:
1. Installs Tailscale
2. Connects to the NovoSSH network
3. Assigns your machine a Tailscale IP (100.x.x.x)
4. Runs as a background service

---

### 2. Direct / Public IP

Connect directly to a publicly reachable server. No relay, no Tailscale needed.

**Requirements:**
- Host must have a public IP or be reachable from your network
- Port 22 (or custom SSH port) must be open

**How to set up:**
1. Add a new host
2. Set **Connection Mode** to "Public/Direct"
3. Enter the public IP or hostname
4. Enter port, username, and auth method
5. Click Connect

**Notes:**
- Web browser: routes through server relay (required by browser security)
- Native clients: connect directly to the host

---

### 3. Server Relay

Route all traffic through the NovoSSH server. Use when direct connections are blocked.

**Requirements:**
- Host must be reachable from the NovoSSH server (203.0.113.10)
- Works with any client including web browsers

**How to set up:**
1. Add a new host
2. Set **Connection Mode** to "Server Relay"
3. Enter the host's IP (public or private if on same network as server)
4. Enter port, username, and auth method
5. Click Connect

**When to use:**
- Corporate firewalls block direct SSH
- Host is behind NAT without port forwarding
- Using the web browser client

---

## Authentication Methods

### Password
- Enter your SSH password in the connection dialog
- Stored locally on device (encrypted with AES-256)

### SSH Key
- Import your private key into NovoSSH's encrypted vault
- Supports RSA and Ed25519 keys
- Keys are stored in Android Keystore / iOS Keychain

### SSH Certificate
- Import certificate + private key as a single PEM file
- Certificate must be prepended to the private key

---

## Adding a Host

1. Click **+ Add Host** or press `Shift+Cmd+N`
2. Fill in the host details:
   - **Label**: Friendly name (e.g., "Production Web Server")
   - **Address**: IP or hostname
   - **Port**: SSH port (default 22)
   - **Username**: SSH username
   - **Auth Method**: Password, Key, or Certificate
   - **Connection Mode**: Tailscale, Direct, or Relay
3. Optionally set:
   - **Tags**: Organize hosts (e.g., "production", "database")
   - **Color**: Visual indicator
   - **Notes**: Any additional info
   - **Proxy**: SOCKS5 proxy settings
   - **Jump Host**: Bastion host for multi-hop connections
4. Click **Save**

---

## Quick Connect

From the terminal view:
1. Click **New Connection**
2. Enter host details
3. Click **Connect**

Or use the Command Palette (`Ctrl/Cmd+K`):
1. Press `Ctrl/Cmd+K`
2. Type the host name
3. Press Enter to connect

---

## Troubleshooting

### Connection Timeout

**Symptoms:** Connection hangs, then shows "Connection timed out"

**Possible causes:**
- Host is offline or firewall blocking port 22
- Wrong IP address
- Using Tailscale mode but host not on Tailscale network

**Fix:**
1. Verify host is online: `ping <host-ip>`
2. Check SSH port is open: `nc -zv <host-ip> 22`
3. If using Tailscale, verify host is connected: `tailscale status`

---

### Authentication Failed

**Symptoms:** "Permission denied" or "Authentication failed"

**Possible causes:**
- Wrong username or password
- SSH key not authorized on host
- Key requires passphrase but none provided

**Fix:**
1. Verify username matches host's SSH config
2. Add your public key to host's `~/.ssh/authorized_keys`
3. If key has passphrase, enter it in NovoSSH settings

---

### Host Key Verification Failed

**Symptoms:** "Host key verification failed" or "Man-in-the-middle attack"

**Possible causes:**
- Host key changed (reinstalled OS)
- Different server at same IP
- First-time connection (TOFU - Trust On First Use)

**Fix:**
- First connection: Accept the host key
- If host was reinstalled: Remove old key from known_hosts and reconnect

---

### Tailscale Connection Fails

**Symptoms:** Connects but no output, or "Connection refused"

**Possible causes:**
- Host not on Tailscale network
- Host's Tailscale service not running
- IP address incorrect

**Fix:**
1. On host: `tailscale status` — verify it's connected
2. Check Tailscale IP: `tailscale ip -4`
3. Verify the IP in NovoSSH matches
4. Restart Tailscale on host: `sudo systemctl restart tailscaled`

---

### SFTP Not Working

**Symptoms:** Terminal connects but SFTP shows empty or errors

**Possible causes:**
- SFTP subsystem not enabled on host
- Restricted shell (rbash) blocking SFTP
- Permission issues on remote directory

**Fix:**
1. Check host SSH config: `grep Subsystem /etc/ssh/sshd_config`
2. Ensure SFTP subsystem is enabled: `Subsystem sftp /usr/lib/openssh/sftp-server`
3. Restart SSH: `sudo systemctl restart sshd`

---

### Port Forwarding Fails

**Symptoms:** Local port forwarding doesn't work

**Possible causes:**
- Port already in use locally
- Remote port not accessible
- Firewall blocking forwarded port

**Fix:**
1. Check local port: `lsof -i :<port>`
2. Try a different local port
3. Verify remote port is accessible from the host

---

## FAQ

### Q: Which connection mode should I use?

**A:** 
- **Tailscale** — Best for private servers. Direct P2P, fast, encrypted. Install the Network Client to connect your machine.
- **Direct** — Best for public cloud servers (AWS, GCP, Azure).
- **Relay** — Best when behind strict firewalls or using the web client.

---

### Q: How do I install the Network Client?

**A:** Run one command:
```bash
curl -fsSL https://novossh.com/network/install.sh | sudo sh
```
It installs Tailscale, connects to the NovoSSH network, and assigns your machine a Tailscale IP (100.x.x.x). No manual Tailscale setup needed.

---

### Q: Can I use NovoSSH with my existing SSH keys?

**A:** Yes. Import your private key into NovoSSH's encrypted vault. Go to **Keys** → **Import Key** and paste your private key or upload the file.

---

### Q: Is my password stored securely?

**A:** Yes. Passwords are encrypted with AES-256 and stored locally. On Android, they're protected by the Android Keystore. On iOS, by the Keychain. They never leave your device unencrypted.

---

### Q: Why does the web browser use relay instead of direct connection?

**A:** Browsers cannot make raw TCP/SSH connections for security reasons. All SSH traffic from the web client goes through the NovoSSH server as a relay. Native apps (desktop, mobile) can connect directly.

---

### Q: How do I connect to a server behind a corporate firewall?

**A:** Use **Server Relay** mode. The connection routes through the NovoSSH server, which is publicly accessible. The firewall only needs to allow outbound HTTPS (port 443) to the NovoSSH server.

---

### Q: Can I connect to multiple servers at once?

**A:** Yes. Open multiple terminal tabs (`Ctrl/Cmd+T`) and connect to different servers in each tab. You can also split the view (`Ctrl/Cmd+Shift+M`) to see multiple terminals side by side.

---

### Q: What happens if my connection drops?

**A:** NovoSSH automatically attempts to reconnect. You'll see a "Reconnecting..." banner. If the host comes back online, the connection resumes. Session state is preserved where possible.

---

### Q: How do I forward ports?

**A:** Go to **Port Forwarding** in the sidebar:
1. Select the active SSH session
2. Choose Local or Remote forwarding
3. Enter local and remote ports
4. Click Start

---

### Q: Can I use NovoSSH with a proxy?

**A:** Yes. In the host configuration, set:
- **Proxy Type**: SOCKS5
- **Proxy Host**: Your proxy address
- **Proxy Port**: Proxy port
- **Proxy Auth**: Username/password if required

---

### Q: How do I set up a jump host (bastion)?

**A:** In the host configuration:
1. Enable **Jump Host**
2. Enter the bastion server's details
3. NovoSSH will connect to the bastion first, then tunnel to the target host

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+K` | Command Palette |
| `Ctrl/Cmd+T` | New Terminal Tab |
| `Ctrl/Cmd+Shift+M` | Toggle Split View |
| `Ctrl/Cmd+B` | Broadcast Input Mode |
| `Shift+Cmd+N` | Add New Host |

---

## Getting Help

- **Support**: support@novossh.com
- **Website**: https://novossh.com
- **GitHub**: https://github.com/incnovoconsulting-cpu/novossh-ce
