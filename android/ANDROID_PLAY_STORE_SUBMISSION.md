# Android Play Store Submission Checklist

## Current Status
- **App Name**: NovoSSH Terminal
- **Package ID**: app.novossh.android
- **Min SDK**: 26 (Android 8.0+)
- **Target SDK**: 36
- **Version**: 1.0.0 (versionCode 1)
- **Architecture**: Kotlin + Jetpack Compose + Material 3
- **Features**: Complete (Hosts, Terminal, SSH Keys, Snippets, Port Forwarding, SFTP, History, Settings)

---

## CRITICAL TASKS BEFORE SUBMISSION

### 1. ✅ Signing Configuration
**Status**: Template ready, keystore needs to be generated

#### Steps:
```bash
# Generate release signing key (one-time, do this locally)
cd android
keytool -genkey -v -keystore novossh.keystore -alias novossh-key \
  -keyalg RSA -keysize 2048 -validity 10000

# At prompts:
# - Enter keystore password (20+ chars, mixed case + numbers + symbols)
# - Enter key password (same or different, but remember it!)
# - Fill in: First/Last name, Org, City, Country
```

#### Configuration:
1. Copy `keystores.properties.example` to `keystores.properties` (never commit)
2. Fill in the path to keystore file and passwords
3. File structure:
   ```
   storeFile=/path/to/novossh.keystore        # Absolute path recommended
   storePassword=YourStrongPassword123!        # Keystore password
   keyAlias=novossh-key                        # Key alias from keytool
   keyPassword=YourKeyPassword123!             # Key-specific password
   ```

#### Security:
- **CRITICAL**: Backup the keystore file and passwords to secure location
- Same keystore must be used for all future Play Store app updates
- If lost, you cannot update the app on Play Store without creating a new listing
- Store securely (e.g., password manager, encrypted USB, secure server)

---

### 2. App Icons & Branding
**Status**: Only XML color placeholders - need actual images

#### Required Assets:

| Asset | Dimensions | Format | Location | Notes |
|-------|-----------|--------|----------|-------|
| App Icon (adaptive) | 108×108 dp (432×432 px @4x) | PNG 32-bit | res/mipmap-* | Used on launcher |
| Round Icon | 108×108 dp (432×432 px @4x) | PNG 32-bit | res/mipmap-* | Fallback for round icon displays |
| Play Store Listing Icon | 512×512 px | PNG 32-bit or WebP | (upload in Play Console) | Displayed in app listing |
| Feature Graphic | 1024×500 px | PNG or WebP | (upload in Play Console) | Store listing hero image |
| Screenshots | Varies by device | PNG/WebP | (upload in Play Console) | Show app features (2-8 recommended) |

#### Implementation Guide:

1. **Export Icon from Design System**
   - If you have a design file (Figma, Adobe XD, etc.), export at 432×432 px
   - Place at: `app/src/main/res/mipmap-xxxhdpi/ic_launcher.png`
   - Android will auto-scale to other densities (hdpi, xhdpi, xxhdpi, xxxhdpi)

2. **Update Manifest Icons** (if using PNG instead of adaptive XML):
   ```xml
   <!-- AndroidManifest.xml -->
   <application
       android:icon="@mipmap/ic_launcher"
       android:roundIcon="@mipmap/ic_launcher_round"
       ...
   ```

3. **Store Listing Graphics**:
   - Created in Play Console directly (no code changes needed)
   - Can be reused from web app Figma/design system

---

### 3. Version Management
**Status**: ✅ Updated to 1.0.0

#### Current Configuration:
```gradle
versionCode 1      // Internal version number (always incrementing)
versionName "1.0.0" // User-visible version
```

#### Future Release Strategy:
- **Minor bug fix**: 1.0.1, versionCode 2
- **Minor feature**: 1.1.0, versionCode 3
- **Major release**: 2.0.0, versionCode 10
- Always increment versionCode, never decrease

---

### 4. Manifest Review
**Status**: ✅ Proper for production

#### Current Manifest (`app/src/main/AndroidManifest.xml`):
```xml
<!-- Permissions: Minimal and appropriate for SSH client -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
<uses-permission android:name="android.permission.USE_FINGERPRINT" />

<!-- Application: Ready for production -->
<application
    android:allowBackup="false"           ✅ Good for security
    android:debuggable="false"            ✅ Set in release buildType
    android:icon="@mipmap/ic_launcher"    ✅ Placeholder until icons created
    android:supportsRtl="true"            ✅ RTL text support
    ...
```

#### Verification Checklist:
- [x] `allowBackup="false"` (no sensitive data backup)
- [x] `debuggable="false"` in release build (see build.gradle)
- [x] Three reasonable permissions (INTERNET, BIOMETRIC, FINGERPRINT)
- [x] Main activity declared with LAUNCHER category
- [x] No hardcoded API keys or secrets

---

### 5. Privacy Policy & Legal
**Status**: ⚠️ REQUIRED BEFORE SUBMISSION

#### Privacy Policy Requirements:
The app collects/stores the following locally:
- SSH connection credentials (hostnames, usernames, encrypted keys)
- SSH history
- Command snippets
- Port forwarding configurations
- User preferences (theme, font size, etc.)

#### What the app does NOT do:
- No cloud syncing (no data leaves device)
- No analytics or crash reporting
- No third-party service integration
- No ads or tracking
- No in-app purchases (future paywall to be added)

#### Privacy Policy Template:
```markdown
# Privacy Policy - NovoSSH Terminal

**Last Updated**: June 13, 2026

## Overview
NovoSSH Terminal is a local SSH terminal client. All data is stored locally on your device.

## Data Collection & Storage
- **SSH Credentials**: Encrypted storage of hostnames, usernames, SSH keys
- **Connection History**: Local log of SSH connections (never transmitted)
- **Snippets & Configuration**: Saved locally in encrypted database

## Data Sharing
- No data is shared with third parties
- No cloud syncing or backup (data stays on your device)
- No analytics or usage tracking

## Permissions Used
- **INTERNET**: Required to establish SSH connections to remote servers
- **USE_BIOMETRIC / USE_FINGERPRINT**: Optional biometric lock on app

## Data Security
- All sensitive data encrypted with AES-256 (EncryptedSharedPreferences)
- App data isolated per device (not accessible to other apps)
- Enable device lock for physical security

## Changes to This Policy
We may update this policy. Check this document periodically.

## Contact
For privacy questions: support@novossh.com
```

**Action Required**:
1. Create `PRIVACY_POLICY.md` in project root
2. Create legal page on website (https://novossh.com/privacy)
3. Link in Play Console during app submission

---

### 6. ProGuard/R8 Optimization
**Status**: ✅ Configured, can be enhanced

#### Current Rules (`app/proguard-rules.pro`):
```proguard
# JSch (SSH library) - Keep all classes
-keep class com.jcraft.jsch.** { *; }
-keep class com.jcraft.jsch.jce.** { *; }

# App code - Keep all Activities, Services, Receivers
-keep public class app.novossh.android.** { *; }

# Compose - Standard rules (no changes needed)
# Room - Standard rules handled by gradle plugin
```

#### Optional Optimization:
- Current rules are conservative (keep all code)
- For production APK size, can use more aggressive rules
- Test thoroughly after optimization changes

#### Recommended ProGuard Settings:
```proguard
-optimizationpasses 5
-repackageclasses
-allowaccessmodification
-useuniqueclassmembernames
```

---

### 7. Testing & Quality Assurance

#### Pre-Submission Testing Checklist:
- [ ] Build release APK: `./gradlew bundleRelease`
- [ ] Test on minimum SDK (Android 8.0, API 26)
- [ ] Test on target SDK (Android 14, API 34)
- [ ] Test on multiple screen sizes (phone, tablet if applicable)
- [ ] Verify all screens are accessible
- [ ] Test SSH connection workflow end-to-end
- [ ] Verify encrypted storage works
- [ ] Test app doesn't crash on low memory
- [ ] Check app permissions are used as described

#### Device Testing:
Recommended test devices:
- Pixel 6 Pro (Android 14) - flagship
- Pixel 5a (Android 12) - mid-range
- Samsung Galaxy A13 (Android 11) - budget
- Tablet: Samsung Galaxy Tab S7 (Android 13)

---

### 8. Build & Release Process

#### Generate Release Build (AAB - Android App Bundle):
```bash
cd android

# Option 1: Signed AAB for Play Store (RECOMMENDED)
./gradlew bundleRelease

# Output: app/build/outputs/bundle/release/app-release.aab

# Option 2: Signed APK (legacy, for direct distribution)
./gradlew assembleRelease

# Output: app/build/outputs/apk/release/app-release.apk
```

#### Verify Signature:
```bash
# Check APK signature
jarsigner -verify -verbose -certs app/build/outputs/apk/release/app-release.apk

# Should show your keystore alias (novossh-key)
```

---

### 9. Play Console Setup & Submission

#### Create Play Console Account:
1. Go to https://play.google.com/console
2. Create developer account ($25 one-time fee)
   3. Create new app (name: "NovoSSH Terminal")

#### Fill App Listing:
1. **Main Store Listing**:
   - Title: "NovoSSH Terminal"
   - Short description: "Fast, secure SSH terminal client"
   - Full description: See template below
   - Category: Tools or Productivity
   - Content rating: Complete questionnaire
   - Privacy policy: Link to privacy policy
   - Developer contact: support@novossh.com

2. **Graphics & Images**:
   - App icon (512×512)
   - Feature graphic (1024×500)
   - Screenshots (2-8 recommended)
   - Promo graphics (optional)

3. **Pricing & Distribution**:
   - Price: Free (initially) or set Starter/Pro tier later
   - Countries: Available in all countries where Play Store is available
   - Content guidelines: Accept and certify compliance

#### Upload APK/AAB:
1. Create release (Create new release → Production)
2. Upload: `app/build/outputs/bundle/release/app-release.aab`
3. Add release notes: "Initial release - Full SSH terminal with key management, port forwarding, and more"
4. Review content rating and privacy policy
5. Submit for review

#### Typical Review Time:
- First submission: 24-48 hours (sometimes longer for new apps)
- Subsequent updates: 2-4 hours

---

## Full App Description Template

```
NovoSSH Terminal is a modern SSH terminal client for Android. Connect to remote servers 
directly from your phone with the speed and security of SSH.

FEATURES:
✓ SSH Terminal - Full-featured xterm-256color terminal
✓ Host Management - Save and organize SSH connections
✓ SSH Key Support - RSA/Ed25519 key import and management
✓ Command Snippets - Quick access to frequently used commands
✓ Port Forwarding - Local and remote port forwarding
✓ SFTP File Browser - Upload, download, and manage remote files
✓ Connection History - Quick reconnect to recent hosts
✓ Material 3 Theme - Beautiful dark theme matching iOS and web versions
✓ Biometric Lock - Optional fingerprint/face unlock
✓ Encrypted Storage - All credentials encrypted with AES-256

SECURITY:
- All data stored locally on your device (no cloud sync)
- SSH credentials encrypted with military-grade AES-256
- Secure SSH library (JSch)
- No tracking, no ads, no unnecessary permissions

REQUIREMENTS:
- Android 8.0 and up
- SSH server access
- SSH key in PEM format (RSA or Ed25519)

NovoSSH Terminal syncs with our web terminal at https://ssh.novossh.com 
(optional - works fully offline).

Questions? Email: support@novossh.com
Privacy Policy: https://novossh.com/privacy
```

---

## Files to Create/Update

| File | Status | Notes |
|------|--------|-------|
| `app/build.gradle` | ✅ Updated | Version 1.0.0, debuggable flags set |
| `keystores.properties` | ⚠️ Manual | Create locally (never commit) |
| `AndroidManifest.xml` | ✅ Ready | No changes needed |
| `PRIVACY_POLICY.md` | ⚠️ Create | Required for Play Store |
| `app/proguard-rules.pro` | ✅ Ready | JSch rules configured |
| App Icons (PNG) | ⚠️ Create | Designer needed |
| Store Graphics | ⚠️ Create | (in Play Console) |
| Play Console Listing | ⚠️ Manual | (web form) |

---

## Next Steps (Priority Order)

1. **Generate signing keystore** (15 min)
   - Run keytool command above
   - Create keystores.properties with details
   - Backup keystore file to secure location

2. **Create privacy policy** (30 min)
   - Use template above
   - Deploy to website
   - Link in Play Console

3. **Create app icons** (1-2 hours)
   - Design 432×432 px icon (use brand colors)
   - Export as PNG
   - Place in res/mipmap directories
   - Verify in Android Studio preview

4. **Prepare store graphics** (1-2 hours)
   - Feature graphic (1024×500)
   - 3-5 screenshots showcasing features
   - Upload in Play Console

5. **Build and test release** (1 hour)
   - `./gradlew bundleRelease`
   - Install on test devices
   - Smoke test key features

6. **Submit to Play Store** (30 min)
   - Create Play Console account
   - Fill app listing
   - Upload AAB
   - Submit for review

7. **Monitor review** (2-3 days)
   - Check Play Console daily
   - Respond to any policy violations
   - Approve when review passes

---

## Release Build Troubleshooting

### "Failed to read key from keystore"
```bash
# Wrong password or keystore path
# Check keystores.properties file
# Verify file exists at path: ls -la /path/to/novossh.keystore
```

### "APK too large"
```bash
# Enable more aggressive R8 optimization:
# Edit app/build.gradle release block:
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true  // Add this line
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

### "Cannot find module JSch"
```bash
# Dependencies not downloaded
./gradlew clean
./gradlew assembleRelease  // Will download deps and rebuild
```

---

## Content Rating Questionnaire (Play Console)

When filling out, expect questions about:
- **Violence**: None - ✅ Select "Not present"
- **Profanity**: None - ✅ Select "Not present"  
- **Adult Content**: None - ✅ Select "Not present"
- **Alcohol/Tobacco**: None - ✅ Select "Not present"
- **Gambling**: None - ✅ Select "Not present"
- **Biometric**: Yes - ✅ "Fingerprint for app unlock"
- **Personal Data**: Yes - ✅ "SSH credentials stored locally"

Result: **Everyone** rating (suitable for all ages)

---

## Monitoring After Launch

Once live on Play Store:
1. Monitor reviews for crashes/issues
2. Consider adding Firebase Crashlytics for production monitoring
3. Plan for:
   - Bug fix releases (1.0.1, 1.0.2, etc.)
   - Feature releases (1.1.0, 1.2.0, etc.)
   - Major versions (2.0.0) for significant updates

---

## Additional Resources

- [Google Play Console Help](https://support.google.com/googleplay/android-developer)
- [Google Play Policies](https://play.google.com/about/developer-content-policy/)
- [Android App Security Best Practices](https://developer.android.com/training/articles/security-tips)
- [AAB Format Info](https://developer.android.com/guide/app-bundle)

---

**Document Version**: 1.0  
**Last Updated**: June 13, 2026  
**Maintained By**: NovoSSH Terminal Team
