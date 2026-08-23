<div align="center">

# NovoSSH Community Edition

**Your infrastructure, one terminal.**

The open source, self-hostable core of [NovoSSH](https://novossh.com) — a modern SSH terminal client with Tailscale-native connectivity, an encrypted vault, and team collaboration.

[![License: AGPL v3](https://img.shields.io/badge/license-AGPLv3-blue.svg)](LICENSE)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

</div>

---

## About this repository

NovoSSH Community Edition (`novossh-ce`) is the open source counterpart to the hosted [novossh.com](https://novossh.com) service. It contains the full web app, backend server, desktop (Tauri), Android, and iOS clients, licensed under **AGPL-3.0** so you can self-host it, audit it, and modify it.

novossh.com itself remains a separately operated hosted product (managed infrastructure, support, and billing on top of this codebase) — using this repository does not require an account, a license key, or a novossh.com subscription. Anything you self-host is entirely yours to run.

## Features

### SSH Terminal
- Interactive shell with xterm.js and full PTY support
- Multi-tab sessions with split view
- Broadcast mode — type on multiple hosts simultaneously
- Command palette for quick actions
- Session recording and playback

### Connection Methods
- **Tailscale P2P** — Direct peer-to-peer SSH through WireGuard, no relay server
- **Server Relay** — Route through your own NovoSSH server (works in browsers)
- **Direct** — Connect to any publicly reachable host
- **SSH Certificates** — CA-signed key authentication on all platforms

### File Transfer & Port Forwarding
- **SFTP Browser** — Upload, download, rename, and create folders
- **Local Port Forwarding** (`-L`) — Tunnel local port to remote service
- **Remote Port Forwarding** (`-R`) — Expose local service on remote server
- **SOCKS5 Proxy** (`-D`) — Route any traffic through SSH tunnel

### Security & Collaboration
- **End-to-end encrypted vault** — Store passwords, SSH keys, and notes
- **Team management** — Shared vaults, organizations, role-based access
- **Audit logs** — Track all connections and commands
- **WebAuthn / 2FA** — Hardware key and TOTP support
- **Biometric lock** — Fingerprint/face unlock on mobile

### Developer Experience
- **Snippets** — Save and run frequently used commands across hosts
- **SSH config parser** — Import hosts from `~/.ssh/config`
- **Keyboard shortcuts** — Command palette, quick connect, global hotkeys
- **Custom terminal themes** — Novo Dark, Dracula, Solarized, and more

---

## Architecture

```
novossh-ce
├── Frontend     React 18 + Vite + Tailwind CSS + xterm.js       (src/)
├── Backend      Node.js + Express + ssh2 + WebSocket            (server/)
├── Desktop      Tauri v2 + Rust (ssh2 crate for native SSH)     (tauri/)
├── Android      Kotlin + Jetpack Compose + JSch                 (android/)
├── iOS          SwiftUI + Citadel SSH library                   (ios/)
└── Deployment   Docker, Kubernetes manifests, Cloudflare Worker (k8s/, infrastructure/, workers/)
```

Database is PostgreSQL. Optional integrations (Stripe billing, Apple/Google IAP, SAML/SSO, PostHog analytics) are present in the codebase but entirely opt-in — none of them are required to run a self-hosted instance.

---

## Self-Hosting Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL
- Docker (optional, recommended for production)

### Run from source

```bash
git clone https://github.com/incnovoconsulting-cpu/novossh-ce.git
cd novossh-ce
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, etc.
npm run dev             # starts web (Vite) + API concurrently
```

### Run with Docker

```bash
cp .env.production.example .env
docker compose -f docker-compose.prod.yml up --build
```

### Deploy to Kubernetes

Manifests are provided in [`k8s/`](k8s/) and [`infrastructure/k8s/`](infrastructure/k8s/) — copy the secrets templates, fill in your own values, and `kubectl apply`. See [`monitoring/`](monitoring/) for optional Prometheus/Grafana setup.

### Desktop builds

```bash
npm run tauri:dev      # desktop dev build (Tauri)
npm run tauri:build    # production desktop build
```

Mobile clients live in [`android/`](android/) and [`ios/`](ios/) and build with standard Gradle / Xcode toolchains respectively.

---

## Tech Stack

**Frontend:** React 18, Vite, Tailwind CSS, xterm.js, Zustand
**Desktop:** Tauri v2, Rust (ssh2, tokio), xterm.js
**Backend:** Node.js, Express, ssh2, WebSocket
**Database:** PostgreSQL
**Mobile:** Kotlin/Compose (Android), SwiftUI/Citadel (iOS)

---

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up your environment, coding conventions, and the PR process. Please also read our [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Found a vulnerability? Please **do not open a public issue** — see [SECURITY.md](SECURITY.md) for how to report it responsibly.

## License

NovoSSH Community Edition is licensed under the [GNU Affero General Public License v3.0](LICENSE). In short: you're free to run, study, modify, and redistribute this software, including as a hosted service — but if you do run a modified version as a network service, you must make your modified source available to its users under the same license.

---

<div align="center">

**[Hosted version at novossh.com →](https://novossh.com)**

</div>
