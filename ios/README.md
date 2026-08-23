# NovoSSH for iOS

Native SwiftUI client. Mirrors the web app's information architecture: Hosts, Snippets, Keychain, History, Settings, and a full SSH terminal session view.

## Stack

- **SwiftUI** (iOS 17+, Mac Catalyst supported)
- **[SwiftTerm](https://github.com/migueldeicaza/SwiftTerm)** — terminal emulation widget
- **[Citadel](https://github.com/orlandos-nl/Citadel)** — pure-Swift SSH client built on SwiftNIO
- **UserDefaults + JSON** for local persistence

## Build

You need macOS with Xcode 15+ and a copy of XcodeGen (the `.xcodeproj` is generated from `project.yml` so the repo stays diff-friendly).

```bash
cd ios
brew install xcodegen librsvg          # one-time
./scripts/render-icon.sh                # turns icon.svg → Icon-1024.png
xcodegen generate
open NovoSSH.xcodeproj
```

In Xcode:
1. Select the `NovoSSH` target → Signing & Capabilities → choose your team.
2. Pick a simulator (or device) → ⌘R.

## Layout

```
ios/
├── project.yml                 # XcodeGen spec (deps, target, build settings)
└── NovoSSH/
    ├── App/                    # @main + RootView (tab bar)
    ├── Models/                 # Host, IdentityKey, Snippet, UserSettings
    ├── Stores/AppStore.swift   # ObservableObject, persists to UserDefaults
    ├── Services/SSHSession.swift  # Citadel client wrapping connect/send/resize/disconnect
    ├── Views/                  # Hosts, HostForm, Terminal, Snippets, Keys, History, Settings, SnippetPicker
    ├── Theme/                  # App palette + 4 terminal palettes (Novo, Dracula, One Dark, Solarized)
    └── Resources/Assets.xcassets
```

## Status by feature

| Feature | Status |
|---|---|
| Hosts CRUD with tags / color / notes | ✅ |
| Snippets with search and per-session paste-to-terminal | ✅ |
| SSH key import (file + paste), passphrase flag | ✅ |
| History view | ✅ |
| Theming (4 terminal palettes, live switch) | ✅ |
| Settings (font size, scrollback, keepalive, copy-on-select) | ✅ |
| Real SSH session (password + key auth) | ⚠️ Needs validation — Citadel APIs evolve; see note below |
| Port forwarding | 🔲 Not yet on mobile |
| SFTP | 🔲 |
| iCloud sync | 🔲 |

### Citadel API note

`Services/SSHSession.swift` is written against Citadel's documented `SSHClient.connect` + `openShell` flow. If you pin a different Citadel version, the `TTY` / `openShell` symbols may need a small adapter; the rest of the app is decoupled from it through the `SSHSession` protocol shape (`connect`, `send(_:)`, `resize(cols:rows:)`, `disconnect`, `onData` callback).

## Security model

- Credentials and private keys are stored in `UserDefaults` for v0.1 ergonomics. **TODO**: move sensitive fields to the iOS Keychain (Security framework) before any TestFlight build — there's a single seam (`AppStore.persist`) to change.
- Host-key trust currently uses `.acceptAnything()` for first-launch usability. **TODO**: persist known-host fingerprints and verify on reconnect.

## Roadmap

- Keychain (`Security.framework`) storage for passwords/keys
- Known-hosts trust-on-first-use with fingerprint pinning
- Port forwarding via Citadel `forward` channels
- SFTP browser
- iCloud (CloudKit) sync of hosts, snippets, keys (with on-device encryption)
- Hardware keyboard shortcuts on iPad / Catalyst
