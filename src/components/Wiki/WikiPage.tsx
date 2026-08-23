import React, { useState } from 'react';

interface WikiArticle {
  id: string;
  title: string;
  category: string;
  content: string;
}

const wikiArticles: WikiArticle[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    category: 'Basics',
    content: `# Getting Started with NovoSSH

Welcome to NovoSSH — a modern SSH terminal client for macOS, Windows, Linux, iOS, and Android.

## Quick Start (2 minutes)

### Step 1: Download NovoSSH

| Platform | Download |
|----------|----------|
| **Android** | [Google Play Store](https://play.google.com/store/apps/details?id=app.novossh.android) |
| **iOS** | [Apple App Store](https://apps.apple.com/app/novossh/id6478876950) |
| **Windows** | [GitHub Releases](https://github.com/incnovoconsulting-cpu/NovoSSH/releases) (MSI or NSIS installer) |
| **macOS / Linux** | [novossh.com](https://novossh.com) (web app, works in any browser) |

### Step 2: Create Your Account

1. Open NovoSSH
2. Tap **Start Free** or **Sign Up**
3. Enter your email and create a password
4. Verify your email (check inbox)
5. You're in!

### Step 3: Connect to Your First Server

1. Tap **+ Add Host** (or press \`Shift+Cmd+N\` on desktop)
2. Fill in:
   - **Label**: "My Server" (any friendly name)
   - **Address**: Your server's IP or hostname
   - **Port**: 22 (default)
   - **Username**: Your SSH username
   - **Auth**: Password, SSH Key, or SSH Certificate
3. Tap **Save**
4. Tap the host to connect

## Understanding the Interface

### Sidebar Navigation

| Icon | Section | What It Does |
|------|---------|--------------|
| Terminal | Terminal | SSH sessions with tabs |
| Server | Hosts | Manage saved servers |
| Code | Snippets | Save and run commands |
| Key | Keychain | SSH key management |
| Lock | Vault | Encrypted credential storage |
| Clock | History | Recent connections |
| Settings | Settings | App preferences |

## First-Time Setup Checklist

### 1. Set Up Your Vault

The vault stores passwords and SSH keys with end-to-end encryption.

1. Go to **Vault** in the sidebar
2. Create your first vault (e.g., "Work", "Personal")
3. Add credentials:
   - Server passwords
   - API tokens
   - SSH private keys
4. Enable vault sync for cross-device access

### 2. Import SSH Keys

If you have existing SSH keys:

1. Go to **Keys** in the sidebar
2. Tap **Import Key**
3. Paste your private key or upload the file
4. Keys are encrypted and stored locally

### 3. Configure Settings

Go to **Settings** to customize:

**Appearance:**
- Terminal theme (Novo Dark, Dracula, Solarized, etc.)
- Font size and family
- Cursor style

**Terminal:**
- Copy on select
- Paste on right-click
- Scrollback buffer size
- Keepalive interval`
  },
  {
    id: 'connecting-hosts',
    title: 'Connecting to Hosts',
    category: 'Basics',
    content: `# Connecting to Hosts

NovoSSH supports multiple connection methods to reach your servers.

## Connection Methods

### 1. Tailscale Tunnel (Recommended)

Direct peer-to-peer connection through your Tailscale/Headscale network.

**Requirements:**
- Host must be registered on the NovoSSH Tailscale network
- Client device must have Tailscale connected (native apps only)

**How to set up:**
1. Add a new host in NovoSSH
2. Set **Connection Mode** to "Tailscale Tunnel"
3. Enter the host's Tailscale IP (format: \`100.x.x.x\`)
4. Enter port (default: 22), username, and auth method
5. Click Connect

### 2. Direct / Public IP

Connect directly to a publicly reachable server.

**Requirements:**
- Host must have a public IP or be reachable from your network
- Port 22 (or custom SSH port) must be open

**How to set up:**
1. Add a new host
2. Set **Connection Mode** to "Public/Direct"
3. Enter the public IP or hostname
4. Enter port, username, and auth method
5. Click Connect

### 3. Server Relay

Route all traffic through the NovoSSH server.

**Requirements:**
- Host must be reachable from the NovoSSH server
- Works with any client including web browsers

**When to use:**
- Corporate firewalls block direct SSH
- Host is behind NAT without port forwarding
- Using the web browser client

## Authentication Methods

### Password
- Enter your SSH password in the connection dialog
- Stored locally on device (encrypted with AES-256)

### SSH Key
- Import your private key into NovoSSH's encrypted vault
- Supports RSA and Ed25519 keys

### SSH Certificate
- Import certificate + private key as a single PEM file
- Certificate must be prepended to the private key
- Supported on all platforms including Android and iOS`
  },
  {
    id: 'managing-hosts',
    title: 'Managing Hosts',
    category: 'Features',
    content: `# Managing Hosts

## Adding a Host

1. Click **+ Add Host** or press \`Shift+Cmd+N\`
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

## Organizing with Groups

1. In **Hosts**, click **+ New Group**
2. Name the group (e.g., "Production", "Staging")
3. Drag hosts into the group
4. Use "Connect All" to connect to every host in a group

## Host Limits

| Resource | Free | Starter | Pro |
|----------|------|---------|-----|
| Hosts | 3 | 25 | Unlimited |
| Snippets | 5 | 50 | Unlimited |
| Vaults | 1 | 10 | Unlimited |
| SSH Keys | 1 | 10 | Unlimited |`
  },
  {
    id: 'using-snippets',
    title: 'Using Snippets',
    category: 'Features',
    content: `# Using Snippets

Snippets save frequently used commands.

## Creating a Snippet

1. Go to **Snippets** -> **+ New Snippet**
2. Enter:
   - **Label**: "Check disk usage"
   - **Command**: \`df -h\`
   - **Tags**: "system", "monitoring"
3. Click **Save**

## Running a Snippet

1. Go to **Snippets**
2. Find your snippet
3. Click **Run** or copy to clipboard
4. Select which host(s) to run it on

## Snippet Packages

Organize snippets into packages (folders):

1. Click **+ New Package**
2. Name the package (e.g., "Docker Commands")
3. Add snippets to the package
4. Run all snippets in a package at once`
  },
  {
    id: 'using-vault',
    title: 'Using the Vault',
    category: 'Features',
    content: `# Using the Vault

The vault stores credentials with end-to-end encryption.

## Adding a Credential

1. Go to **Vault** -> select a vault
2. Click **+ Add Entry**
3. Choose type:
   - **Password**: username/password pairs
   - **SSH Key**: private keys
   - **Note**: freeform text
4. Enter details and save

## Sharing a Vault

1. Go to **Vault Settings**
2. Click **Share**
3. Enter team member's email
4. Set permission level (View, Edit, Admin)
5. Click **Share**

## Vault Sync

Enable sync to access your vault across devices:

1. Go to **Settings** -> **Vault**
2. Enable **Cloud Sync**
3. Your vault syncs automatically

## Offline Access

Your vault works offline. Changes sync when you reconnect:
- View cached credentials
- Add/edit entries (queues for sync)
- Conflict resolution when sync resumes`
  },
  {
    id: 'port-forwarding',
    title: 'Port Forwarding',
    category: 'Features',
    content: `# Port Forwarding

NovoSSH supports local, remote, and dynamic (SOCKS5) port forwarding.

## Local Port Forwarding

Forward a local port to a remote server:

1. Go to **Port Forwarding** in the sidebar
2. Select an active SSH session
3. Click **+ New Forward**
4. Choose **Local**
5. Enter:
   - **Local Port**: Port on your machine (e.g., 3306)
   - **Remote Host**: Target host (e.g., localhost)
   - **Remote Port**: Target port (e.g., 3306)
6. Click **Start**

**Example:** Access a remote MySQL database on localhost:3306:
- Local Port: 3306
- Remote Host: localhost
- Remote Port: 3306

## Remote Port Forwarding

Expose a local service to the remote server:

1. Go to **Port Forwarding**
2. Select an active SSH session
3. Click **+ New Forward**
4. Choose **Remote**
5. Enter:
   - **Local Port**: Port on your machine
   - **Remote Host**: 0.0.0.0 or specific IP
   - **Remote Port**: Port to expose
6. Click **Start**

## Dynamic (SOCKS5) Forwarding

Route any traffic through the SSH connection via a local SOCKS5 proxy:

1. Go to **Port Forwarding**
2. Select an active SSH session
3. Click **+ New Forward**
4. Choose **Dynamic (SOCKS)**
5. Set the **Bind Port** (default: 1080)
6. Click **Start**

Configure your applications to use the SOCKS5 proxy at \`127.0.0.1:1080\`.

## Stopping a Forward

1. Go to **Port Forwarding**
2. Find the active forward
3. Click **Stop**

## Port Forwarding Limits

| Plan | Active Forwards |
|------|----------------|
| Free | 1 |
| Starter | 5 |
| Pro | Unlimited |`
  },
  {
    id: 'sftp',
    title: 'SFTP File Browser',
    category: 'Features',
    content: `# SFTP File Browser

Transfer files to and from your servers.

## Connecting via SFTP

1. Connect to a host via SSH first
2. Go to **SFTP** in the sidebar
3. The file browser opens for the connected host

## Browsing Files

- **Double-click** a folder to open it
- **Breadcrumb navigation** at the top shows current path
- **Up button** goes to parent directory
- **Refresh** reloads the current directory

## File Operations

### Upload Files
1. Click **Upload** button
2. Select files from your device
3. Files upload to current directory

### Download Files
1. Select a file
2. Click **Download**
3. File saves to your device

### Create Folder
1. Click **New Folder**
2. Enter folder name
3. Click **Create**

### Rename
1. Right-click a file/folder
2. Select **Rename**
3. Enter new name
4. Click **Confirm**

### Delete
1. Right-click a file/folder
2. Select **Delete**
3. Confirm deletion

## Hidden Files

Click the eye icon to show/hide hidden files (files starting with .)

## Transfer Progress

Large file transfers show progress with:
- Bytes transferred
- Transfer speed
- Estimated time remaining`
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    category: 'Reference',
    content: `# Keyboard Shortcuts

## Global Shortcuts

| Shortcut | Action |
|----------|--------|
| \`Ctrl/Cmd+K\` | Command Palette |
| \`Ctrl/Cmd+,\` | Open Settings |
| \`Ctrl/Cmd+Shift+N\` | New Host |

## Terminal Shortcuts

| Shortcut | Action |
|----------|--------|
| \`Ctrl/Cmd+T\` | New Terminal Tab |
| \`Ctrl/Cmd+W\` | Close Current Tab |
| \`Ctrl/Cmd+Shift+M\` | Toggle Split View |
| \`Ctrl/Cmd+B\` | Toggle Broadcast Mode |
| \`Ctrl/Cmd+F\` | Search in Terminal |
| \`Ctrl/Cmd+Shift+C\` | Copy Selection |
| \`Ctrl/Cmd+Shift+V\` | Paste |

## Tab Navigation

| Shortcut | Action |
|----------|--------|
| \`Ctrl/Cmd+1-9\` | Switch to Tab 1-9 |
| \`Ctrl/Cmd+Tab\` | Next Tab |
| \`Ctrl/Cmd+Shift+Tab\` | Previous Tab |

## Terminal Editing

| Shortcut | Action |
|----------|--------|
| \`Ctrl+C\` | Send SIGINT (interrupt) |
| \`Ctrl+D\` | Send EOF (exit) |
| \`Ctrl+Z\` | Send SIGTSTP (suspend) |
| \`Ctrl+L\` | Clear screen |
| \`Ctrl+A\` | Move to start of line |
| \`Ctrl+E\` | Move to end of line |
| \`Ctrl+U\` | Clear line before cursor |
| \`Ctrl+K\` | Clear line after cursor |
| \`Ctrl+W\` | Delete word before cursor |

## Global Hotkeys (Desktop - Windows/Linux via Tauri)

| Shortcut | Action |
|----------|--------|
| \`Ctrl+Shift+N\` | New Terminal Tab |
| \`Ctrl+Shift+T\` | New Terminal Tab |
| \`Ctrl+Shift+H\` | Quick Host Connect |
| \`Ctrl+Shift+S\` | Open SFTP Browser |`
  },
  {
    id: 'security',
    title: 'Security & Privacy',
    category: 'Security',
    content: `# Security & Privacy

NovoSSH is built with security as a priority.

## Encryption

### At Rest
- All passwords encrypted with **AES-256**
- SSH keys stored in OS secure vault (Android Keystore / iOS Keychain)
- Vault data end-to-end encrypted
- No plaintext credentials stored

### In Transit
- All SSH connections encrypted via SSH protocol
- WebSocket connections use TLS (wss://)
- No sensitive data transmitted unencrypted

## Authentication

### Biometric Lock
Protect NovoSSH with fingerprint or face recognition:

1. Go to **Settings** -> **Security**
2. Enable **Biometric Lock**
3. Confirm with your fingerprint/face

### Two-Factor Authentication
Enable 2FA for your NovoSSH account:

1. Go to **Settings** -> **Security**
2. Enable **Two-Factor Authentication**
3. Scan QR code with authenticator app
4. Enter verification code

## Data Privacy

- **No tracking**: We don't track your usage or behavior
- **No analytics**: No third-party analytics tools
- **Local-first**: Your data stays on your device
- **No cloud dependency**: Works fully offline

## Security Best Practices

1. **Use SSH keys** instead of passwords when possible
2. **Enable biometric lock** for quick secure access
3. **Use vault sync** to keep credentials encrypted across devices
4. **Enable 2FA** on your NovoSSH account
5. **Review connection history** regularly
6. **Use jump hosts** for sensitive servers

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** open a public GitHub issue
2. Email security@novossh.com
3. Include steps to reproduce
4. Allow time for a fix before disclosure`
  },
  {
    id: 'faq',
    title: 'Frequently Asked Questions',
    category: 'Support',
    content: `# Frequently Asked Questions

## General

### What is NovoSSH?
NovoSSH is a modern SSH terminal client for managing your infrastructure. It supports direct SSH connections, SFTP file transfers, port forwarding, and team collaboration.

### Is NovoSSH free?
Yes! NovoSSH has a free tier with 3 hosts, 5 snippets, 1 vault, and 1 SSH key. Upgrade to Starter ($5/mo) or Pro ($10/mo) for more features and unlimited resources.

### Which platforms are supported?
- **Android**: Native app on Google Play
- **iOS**: Native app on App Store
- **Windows**: Native desktop app via [GitHub Releases](https://github.com/incnovoconsulting-cpu/NovoSSH/releases)
- **macOS / Linux**: Web app at novossh.com

## Connections

### Why does the web browser use relay?
Browsers cannot make raw TCP/SSH connections. Web traffic goes through the server relay. Native apps (desktop, mobile) connect directly.

### Can I use my existing SSH keys?
Yes! Import your private key into NovoSSH's encrypted vault. Go to **Keys** -> **Import Key**.

### What is Tailscale Tunnel?
Tailscale Tunnel provides direct peer-to-peer connections through the Tailscale network. Both client and host must be on Tailscale.

### Does NovoSSH support SSH certificates?
Yes. SSH certificate authentication is supported on all platforms. Import your CA-signed certificate as a single PEM file (certificate prepended to private key).

## Security

### Is my data secure?
Yes. All passwords are encrypted with AES-256. SSH keys are stored in your device's secure vault. Vault data is end-to-end encrypted.

### Does NovoSSH collect my data?
No. NovoSSH has no tracking, analytics, or data collection. Your data stays on your device.

## Billing

### How do I upgrade my plan?
Go to **Settings** -> **Subscription** -> **Upgrade**. Choose Starter or Pro plan.

### Can I cancel anytime?
Yes. Cancel anytime from Settings -> Subscription. Your plan remains active until the end of the billing period.

### Do you offer team plans?
Yes! Pro plan includes team features: shared vaults, organization management, and audit logs.

## Support

### How do I get help?
- **Email**: support@novossh.com
- **Website**: https://novossh.com
- **GitHub**: https://github.com/incnovoconsulting-cpu/NovoSSH

### How do I report a bug?
Open an issue on GitHub: https://github.com/incnovoconsulting-cpu/NovoSSH/issues`
  }
];

const categories = [...new Set(wikiArticles.map(a => a.category))];

export function WikiPage() {
  const [selectedArticle, setSelectedArticle] = useState<string>('getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  const article = wikiArticles.find(a => a.id === selectedArticle);

  const filteredArticles = searchQuery
    ? wikiArticles.filter(a =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : wikiArticles;

  const renderMarkdown = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableRows: string[][] = [];

    const flushTable = () => {
      if (tableRows.length === 0) return;
      const header = tableRows[0];
      const data = tableRows.slice(2); // skip separator row
      elements.push(
        <div key={`table-${elements.length}`} className="my-3 overflow-x-auto rounded-lg border border-white/[0.06]">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                {header.map((cell, j) => (
                  <th key={j} className="px-3 py-2 text-left font-medium text-slate-300">{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-white/[0.04] last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 text-slate-400">{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    };

    const renderInline = (text: string): React.ReactNode => {
      const parts: React.ReactNode[] = [];
      let remaining = text;
      let key = 0;
      while (remaining.length > 0) {
        const codeMatch = remaining.match(/`([^`]+)`/);
        const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
        const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
        const match = [codeMatch, boldMatch, linkMatch].filter(Boolean).sort((a, b) => (a!.index ?? 0) - (b!.index ?? 0))[0];
        if (!match || match.index === undefined) { parts.push(remaining); break; }
        if (match.index > 0) parts.push(remaining.slice(0, match.index));
        const matchLen = match[0]?.length ?? 0;
        if (match === codeMatch) {
          parts.push(<code key={key++} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[12px] font-mono text-neon/80">{codeMatch![1]}</code>);
          remaining = remaining.slice(match.index + matchLen);
        } else if (match === boldMatch) {
          parts.push(<strong key={key++} className="font-semibold text-slate-200">{boldMatch![1]}</strong>);
          remaining = remaining.slice(match.index + matchLen);
        } else {
          parts.push(<a key={key++} href={linkMatch![2]} target="_blank" rel="noopener noreferrer" className="text-neon underline underline-offset-2 hover:text-neon-400">{linkMatch![1]}</a>);
          remaining = remaining.slice(match.index + matchLen);
        }
      }
      return parts;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('| ')) {
        const cells = line.split('|').filter(c => c.trim()).map(c => c.trim());
        if (cells.every(c => c.match(/^[-]+$/))) { tableRows.push(cells); inTable = true; continue; }
        if (!inTable) { tableRows = []; inTable = true; }
        tableRows.push(cells);
        continue;
      }
      if (inTable) flushTable();

      if (line.startsWith('# ')) { elements.push(<h1 key={i} className="text-3xl font-bold text-white mb-6 mt-8 first:mt-0">{line.slice(2)}</h1>); continue; }
      if (line.startsWith('## ')) { elements.push(<h2 key={i} className="text-xl font-semibold text-white mb-4 mt-8">{line.slice(3)}</h2>); continue; }
      if (line.startsWith('### ')) { elements.push(<h3 key={i} className="text-lg font-medium text-slate-200 mb-3 mt-6">{line.slice(4)}</h3>); continue; }
      if (line.startsWith('- ')) { elements.push(<div key={i} className="flex gap-2 py-0.5"><span className="text-neon mt-1.5 text-xs">•</span><span className="text-[13px] text-slate-400">{renderInline(line.slice(2))}</span></div>); continue; }
      if (line.match(/^\d+\. /)) { const m = line.match(/^(\d+)\. (.*)/); if (m) elements.push(<div key={i} className="flex gap-2 py-0.5"><span className="text-neon font-medium text-[13px]">{m[1]}.</span><span className="text-[13px] text-slate-400">{renderInline(m[2])}</span></div>); continue; }
      if (line.trim() === '') { elements.push(<div key={i} className="h-1" />); continue; }
      elements.push(<p key={i} className="text-[13px] leading-relaxed text-slate-400 py-0.5">{renderInline(line)}</p>);
    }
    if (inTable) flushTable();
    return elements;
  };

  return (
    <div className="flex h-full bg-ink-950">
      {/* Sidebar */}
      <div className="w-64 border-r border-white/[0.06] bg-ink-900/50 flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white mb-3">Documentation</h2>
          <input
            type="text"
            placeholder="Search docs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-white/[0.08] bg-white/5 px-3 py-2 text-[13px] text-white placeholder-slate-600 outline-none focus:border-[#00e5ff]/50"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {categories.map(cat => (
            <div key={cat} className="mb-4">
              <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{cat}</div>
              {filteredArticles.filter(a => a.category === cat).map(article => (
                <button
                  key={article.id}
                  onClick={() => setSelectedArticle(article.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors ${
                    selectedArticle === article.id
                      ? 'bg-[#00e5ff]/10 text-[#00e5ff]'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  {article.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-8">
          {article && renderMarkdown(article.content)}
        </div>
      </div>
    </div>
  );
}

export default WikiPage;
