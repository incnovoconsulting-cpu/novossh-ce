# NovoSSH Terminal Android

A native Android SSH terminal client built with Kotlin + Jetpack Compose + Material 3. Connect to remote servers directly from your phone with speed, security, and elegance.

**Status**: Ready for Google Play Store submission (v1.0.0)

## Requirements
- Android Studio Hedgehog (2023.1.1) or later
- JDK 17
- Android SDK 34, min SDK 26 (Android 8.0+)

## Quick Start

### Debug Build (Development)
```bash
cd android
./gradlew assembleDebug      # Build debug APK
./gradlew installDebug       # Install on connected device
```

### Release Build (Play Store)
```bash
cd android

# Step 1: Create signing keystore (first time only)
keytool -genkey -v -keystore novossh.keystore -alias novossh-key \
  -keyalg RSA -keysize 2048 -validity 10000

# Step 2: Create keystores.properties with signing config
cp keystores.properties.example keystores.properties
# Edit keystores.properties with keystore path and passwords

# Step 3: Build signed AAB for Play Store
./gradlew bundleRelease
# Output: app/build/outputs/bundle/release/app-release.aab

# Or build APK directly
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```

**See [ANDROID_PLAY_STORE_SUBMISSION.md](ANDROID_PLAY_STORE_SUBMISSION.md) for complete submission guide.**

## Features

✅ **SSH Terminal** — xterm-256color terminal with full keyboard support  
✅ **Host Management** — Save, organize, and quickly connect to SSH servers  
✅ **SSH Key Support** — Import and manage RSA/Ed25519 keys securely  
✅ **Command Snippets** — Library of command shortcuts with tags  
✅ **Port Forwarding** — Local and remote port forwarding setup  
✅ **SFTP File Browser** — Upload, download, and manage remote files  
✅ **Connection History** — Quick reconnect to frequently used hosts  
✅ **Material 3 Theme** — Beautiful dark theme matching web/iOS versions  
✅ **Biometric Lock** — Optional fingerprint/face unlock (Android 9+)  
✅ **Encrypted Storage** — AES-256 encryption for all credentials  

## Architecture

**Framework Stack**:
- **Kotlin + Jetpack Compose** — Modern declarative UI (no XML layouts)
- **Material 3** — Latest Material Design with dynamic theming
- **Navigation Compose** — Type-safe navigation between screens

**Data & Security**:
- **Room** — SQLite database (3 entities: Host, IdentityKey, Snippet, PortForwarding)
- **EncryptedSharedPreferences** — AES-256 encrypted credential storage
- **DataStore** — Persistent user preferences
- **Android Keystore** — Hardware-backed encryption keys

**SSH & Networking**:
- **JSch** — Battle-tested SSH client library (same as ConnectBot)
- **Coroutines** — Async SSH operations without blocking UI
- **StateFlow** — Reactive state management across screens

## Project Structure

```
android/
├── app/
│   ├── src/main/
│   │   ├── java/app/novossh/android/
│   │   │   ├── MainActivity.kt              # Entry point
│   │   │   ├── database/
│   │   │   │   ├── AppDatabase.kt           # Room database
│   │   │   │   └── entities/                # Data models
│   │   │   ├── repository/                  # Data layer
│   │   │   ├── viewmodel/                   # Business logic
│   │   │   ├── ui/
│   │   │   │   ├── navigation/              # Navigation graph
│   │   │   │   ├── screens/                 # 8 screens
│   │   │   │   │   ├── HostsScreen
│   │   │   │   │   ├── TerminalScreen
│   │   │   │   │   ├── KeysScreen
│   │   │   │   │   ├── SnippetsScreen
│   │   │   │   │   ├── PortForwardingScreen
│   │   │   │   │   ├── SFTPBrowserScreen
│   │   │   │   │   ├── HistoryScreen
│   │   │   │   │   └── SettingsScreen
│   │   │   │   └── theme/                   # Material 3 styling
│   │   │   └── util/                        # Helpers & extensions
│   │   └── res/
│   │       ├── mipmap/                      # App icons
│   │       └── values/                      # Strings, themes, colors
│   └── build.gradle                         # App build config
├── build.gradle                             # Root build config
├── settings.gradle
├── gradle.properties
├── gradlew                                  # Gradle wrapper
├── keystores.properties.example             # Signing template
├── README.md                                # This file
└── ANDROID_PLAY_STORE_SUBMISSION.md         # ⭐ Submission guide
```

## Play Store Submission

This app is ready for Google Play Store submission (v1.0.0). Complete submission checklist:

**See [ANDROID_PLAY_STORE_SUBMISSION.md](ANDROID_PLAY_STORE_SUBMISSION.md) for:**
1. ✅ Signing configuration setup
2. ⚠️  App icons & branding (designer needed)
3. ✅ Version management (already at 1.0.0)
4. ✅ Manifest & security review
5. ⚠️  Privacy policy (template provided)
6. ✅ ProGuard optimization
7. Testing & QA checklist
8. Step-by-step Play Console submission guide

## Testing

### Unit Tests
```bash
# Run all unit tests
./gradlew testDebug

# Run specific test class
./gradlew testDebug --tests "app.novossh.android.viewmodel.*"
```

### Manual Testing on Device
```bash
# Install debug build
./gradlew installDebug

# Follow smoke test checklist in ANDROID_PLAY_STORE_SUBMISSION.md
```

## Security

- **Encryption at Rest**: AES-256 for all sensitive data (EncryptedSharedPreferences + Android Keystore)
- **Encryption in Transit**: HTTPS for any server communication; SSH for terminal
- **Biometric Lock**: Optional fingerprint/face unlock with BiometricPrompt API
- **No Cloud Sync**: All data stored locally on device (unless user enables web sync)
- **No Tracking**: No analytics, crash reporting, or user tracking
- **Audited Dependencies**: JSch, AndroidX, Jetpack Compose

See [PRIVACY_POLICY.md](../PRIVACY_POLICY.md) for complete privacy details.

## Development Workflow

### Local Development
```bash
cd android
./gradlew assembleDebug          # Build
./gradlew installDebug           # Install on device
# Edit code in Android Studio and use hot reload
```

### Code Style
- Kotlin with coroutines
- Jetpack Compose for UI (no XML layouts)
- MVVM architecture (ViewModel + Repository)
- Repository pattern for data access

### Debugging
1. **Android Studio Debugger**: Set breakpoints and step through code
2. **Logcat**: Run `./gradlew installDebug -i`, then monitor logs
3. **Database Inspector**: Android Studio → Device Explorer → database/app.novossh.android.db
4. **Layout Inspector**: Inspect Compose UI hierarchy in real time

## Troubleshooting

### Build Issues
```bash
# Clean and rebuild
./gradlew clean && ./gradlew assembleDebug

# Update Gradle/dependencies
./gradlew --refresh-dependencies

# Check Kotlin version compatibility
./gradlew kotlinVersion
```

### Runtime Issues
- **App crashes on launch**: Check logcat for exceptions
- **SSH connection fails**: Verify server reachability and credentials
- **Biometric not working**: Check Android version (9+) and device capability
- **Database errors**: Clear app data via Settings → Apps → NovoSSH Terminal → Storage

## License

Proprietary - Owned by Novo Consulting Inc.

NovoSSH Terminal

## Additional Resources

- **Privacy**: [PRIVACY_POLICY.md](../PRIVACY_POLICY.md)
- **Play Store Submission**: [ANDROID_PLAY_STORE_SUBMISSION.md](ANDROID_PLAY_STORE_SUBMISSION.md)
- **JSch Documentation**: http://www.jcraft.com/jsch/
- **Android Docs**: https://developer.android.com/docs
- **Jetpack Compose**: https://developer.android.com/jetpack/compose

---

**Current Version**: 1.0.0  
**Last Updated**: June 13, 2026  
**Maintainer**: NovoSSH Terminal Team
