# Google Play Store Listing - NovoSSH Terminal Android

This document contains all the text and metadata needed to create the app listing on Google Play Console.

## Store Listing Metadata

### App Title
```
NovoSSH Terminal
```
(Character count: 14 / 50 max)

### Short Description
```
Fast, secure SSH terminal client for Android
```
(Character count: 45 / 80 max)

### Full Description

```
NovoSSH Terminal is a native SSH terminal client for Android. Connect to remote servers 
directly from your phone with the speed and security of SSH.

FEATURES:
✓ SSH Terminal - Full xterm-256color terminal with keyboard support
✓ Host Management - Save, organize, and quickly connect to SSH servers
✓ SSH Key Support - Import RSA and Ed25519 keys securely
✓ Command Snippets - Quick access to frequently used commands
✓ Port Forwarding - Local and remote port forwarding setup
✓ SFTP File Browser - Upload, download, and manage remote files
✓ Connection History - Quick reconnect to frequently used hosts
✓ Material 3 Theme - Beautiful dark theme matching web and iOS versions
✓ Biometric Lock - Optional fingerprint/face unlock (Android 9+)
✓ Encrypted Storage - All credentials encrypted with AES-256

SECURITY:
• All data stored locally on your device (no cloud sync)
• SSH credentials encrypted with military-grade AES-256
• Private keys secured by Android Keystore system
• Secure SSH library (JSch)
• No tracking, analytics, or user profiling
• No unnecessary permissions

REQUIREMENTS:
• Android 8.0 (API 26) or higher
• SSH access to remote servers
• SSH key in PEM format (RSA or Ed25519)

PRIVACY:
NovoSSH Terminal respects your privacy. We don't collect, store, or transmit your SSH 
credentials. All data is encrypted locally on your device.

See our privacy policy at: https://novossh.com/privacy

SUPPORT:
For questions or issues: support@novossh.com
Website: https://novossh.com

---

v1.0.0 - Initial Release
```

(Character count: ~1,450 / 4,000 max)

---

## Content Rating Questionnaire Answers

When filling out the content rating questionnaire on Google Play Console, use these answers:

### Violence & Bloodshed
- **Question**: "Does your app contain graphic violence or bloodshed?"
- **Answer**: No

### Disruptive or Hateful Content
- **Question**: "Does your app contain content related to violence against a group based on their personal characteristics?"
- **Answer**: No

### Substance Abuse
- **Question**: "Does your app promote or encourage the use of illegal drugs or controlled substances?"
- **Answer**: No

### Sexual Content
- **Question**: "Does your app contain sexual or erotic content?"
- **Answer**: No

### Profanity or Crude Humor
- **Question**: "Does your app contain profanity or crude language?"
- **Answer**: No

### Gambling
- **Question**: "Does your app engage in gambling or promote gambling?"
- **Answer**: No

### Biometric & Sensitive Data
- **Question**: "Does your app use or require biometric, fingerprint, or other identity verification?"
- **Answer**: Yes
- **Details**: Optional biometric unlock feature (fingerprint/face unlock)

### Personal Data
- **Question**: "Does your app collect and transmit personal information (email, passwords, credit cards, etc.)?"
- **Answer**: Yes
- **Details**: SSH credentials (hostnames, usernames, private keys) are stored locally, encrypted, never transmitted or shared

### Financial Info
- **Question**: "Does your app handle financial transactions?"
- **Answer**: No

---

## Store Listing Metadata Summary

| Field | Value |
|-------|-------|
| **App Title** | NovoSSH Terminal |
| **Developer Contact Email** | support@novossh.com |
| **Feedback Email** | support@novossh.com |
| **Support Website** | https://ssh.novossh.com |
| **Privacy Policy URL** | https://novossh.com/privacy |
| **App Category** | Tools (or Productivity) |
| **Primary Language** | English (US) |
| **Target Audience** | IT Professionals, Developers, System Administrators |
| **Pricing** | Free |
| **In-App Purchases** | None (for 1.0.0) |

---

## Store Listing Graphics

### 1. App Icon (512×512 pixels)
- **Format**: PNG with alpha channel (transparent background)
- **File**: Export as `play-store-icon-512.png`
- **Notes**: Must be recognizable at small sizes (32px+)
- **Design**: Follow Android Adaptive Icon guidelines
- **Colors**: Dark background (#1a1a2e or similar) with cyan/bright accent

**To create**:
1. Design a square icon (512×512px)
2. Include safe zone circle (inner 66% for important content)
3. Test at 48px, 96px, 192px, 256px to ensure clarity
4. Export as PNG with transparency
5. Upload to Play Console

### 2. Feature Graphic (1024×500 pixels)
- **Format**: PNG or JPG
- **File**: Export as `play-store-feature-graphic-1024x500.png`
- **Aspect Ratio**: Exactly 1024×500 (2:1)
- **Notes**: Shown as banner at top of store listing
- **Design Ideas**:
  - Terminal window with NovoSSH Terminal logo
  - SSH connections flowing across device
  - Dark background with cyan/green highlights
  - Headline: "Native SSH Terminal for Android"

**To create**:
1. Design in Figma (use 1024×500 template)
2. Include app name and key feature text
3. Use brand colors consistently
4. Export as PNG/JPG
5. Upload to Play Console

### 3. Screenshots (minimum 2, up to 8)
- **Format**: PNG or JPG
- **Size**: 1080×1920 pixels (9:16 ratio for phones)
  OR 1440×2560 pixels (9:16 ratio, higher resolution)
  OR 1080×1920 for 5.5" device format (Play Console preference)
- **File**: `play-store-screenshot-1.png`, `play-store-screenshot-2.png`, etc.
- **Notes**: Show actual app interface with real usage

**Recommended Screenshots**:

1. **Screen 1 - Host Management** (Overview)
   - Show hosts list with multiple connections
   - Include color-coded hosts
   - Text overlay: "Organize SSH Connections"

2. **Screen 2 - Terminal in Action** (Main feature)
   - Show active SSH terminal
   - Display command output
   - Text overlay: "Full PTY Terminal"

3. **Screen 3 - Key Management** (Security)
   - Show SSH key import interface
   - Text overlay: "Secure Key Storage"

4. **Screen 4 - Port Forwarding** (Advanced)
   - Show port forwarding setup
   - Text overlay: "Port Forwarding & SFTP"

**To create**:
1. Take screenshots on Android device (Pixel 6 or similar 1080px width)
2. Add overlays in design tool (app name, feature text)
3. Use consistent branding/colors
4. Export as PNG
5. Upload in correct order to Play Console

---

## Graphics Design Checklist

Before uploading graphics:

- [ ] App icon is 512×512px, PNG format with alpha channel
- [ ] Feature graphic is exactly 1024×500px
- [ ] Screenshots are 1080×1920px (or 1440×2560px) with 9:16 ratio
- [ ] All graphics use consistent brand colors
- [ ] Text is readable and centered
- [ ] No URLs or contact info visible (use overlays instead)
- [ ] All graphics reviewed for typos and professionalism
- [ ] Consider device notches/safe areas (Google handles this)

---

## Pricing Information

**For 1.0.0 Release**:
- Price: **Free**
- In-App Purchases: **None**
- Subscription: **None (for now)**

**Future (Phase 4+)**:
- Plan to add optional Starter/Pro subscription
- Update listing when pricing model is ready

---

## Testing Instructions (Optional)

You can add a test questionnaire section for Play Console's pre-launch report:

```
Pre-Launch Testing Instructions:

1. Start app and allow permissions
2. Create a new SSH host connection
3. Import an SSH key (use test key in format: ssh-keygen -t rsa)
4. Attempt SSH connection to test server
5. Verify terminal input/output works
6. Test port forwarding configuration
7. Navigate all screens (Settings, History, SFTP)
8. Test biometric unlock (if device supports)
9. Verify no crashes on permission denial
10. Disconnect and close app normally
```

---

## Release Notes

Create release notes for your first release:

```
Version 1.0.0 - Initial Release (June 13, 2026)

FEATURES:
• Native SSH terminal with xterm-256color support
• SSH host management with color labels and tags
• RSA and Ed25519 key management with encrypted storage
• Command snippet library for quick access
• Port forwarding (local, remote, SOCKS5)
• SFTP file browser for remote file operations
• Connection history for quick reconnect
• Material 3 dark theme with dynamic colors
• Optional biometric unlock (fingerprint/face)
• Full keyboard input with special key support
• Material 3 design language

SECURITY FEATURES:
• All credentials encrypted with AES-256
• Private keys secured by Android Keystore
• No data transmission to third parties
• Secure SSH library (JSch)

REQUIREMENTS:
• Android 8.0 or higher
• SSH server access
• SSH key in PEM format

Known Limitations:
• Limited to PEM format SSH keys (OpenSSH format coming soon)
• SFTP browser is read-only in 1.0.0 (write support in 1.1.0)

See privacy policy: https://novossh.com/privacy
Support: support@novossh.com
```

---

## Submission Checklist

Before submitting to Google Play:

### Metadata
- [ ] App title entered
- [ ] Short description entered
- [ ] Full description entered
- [ ] Privacy policy URL configured
- [ ] Support email configured
- [ ] App category selected (Tools/Productivity)
- [ ] Target audience selected

### Graphics
- [ ] App icon uploaded (512×512)
- [ ] Feature graphic uploaded (1024×500)
- [ ] At least 2 screenshots uploaded
- [ ] All graphics follow brand guidelines
- [ ] No placeholder/temp graphics remaining

### Content Rating
- [ ] Content rating questionnaire completed
- [ ] Rating accepted (should be "Everyone" for SSH client)

### Pricing & Distribution
- [ ] Pricing set to Free
- [ ] Target countries selected
- [ ] Play Store Developer Agreement accepted

### Release
- [ ] AAB file uploaded
- [ ] Release notes entered
- [ ] Pre-launch report passed (0 critical issues)
- [ ] All required fields filled out

### Legal
- [ ] Privacy policy reviewed and up-to-date
- [ ] Biometric feature properly disclosed
- [ ] Permissions justified
- [ ] No sensitive information in strings/code

---

## Testing Regions

For Play Console pre-launch report testing, your app will be tested on:

**Real Devices** (typically):
- Pixel 4a (Android 11, 1080×2340)
- Samsung Galaxy A11 (Android 10, 720×1600)
- OnePlus 7 (Android 10, 1080×2340)

**Virtual Devices** (emulators):
- Android 8 (API 26)
- Android 9 (API 28)
- Android 12 (API 31)
- Android 14 (API 34)

Results will be available in Play Console within 30 minutes after upload.

---

## Monitor After Launch

**Post-Launch Monitoring**:
- Check crash reports daily for first week
- Monitor review ratings and user comments
- Set up email alerts for 1-2 star reviews
- Respond to user feedback promptly
- Plan for bug fix release (1.0.1) if needed
- Consider feature requests for version 1.1.0

---

## Additional Resources

- [Google Play Policy Center](https://play.google.com/about/developer-content-policy/)
- [App Accessibility Guidelines](https://support.google.com/accessibility/android/answer/6006564)
- [Google Play Metrics Help](https://support.google.com/googleplay/android-developer/answer/139631)
- [Android App Publishing Guide](https://developer.android.com/studio/publish)

---

**Document Version**: 1.0  
**Last Updated**: June 13, 2026
