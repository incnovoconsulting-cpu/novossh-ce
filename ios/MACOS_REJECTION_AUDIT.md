# macOS App Store Rejection Audit

## CRITICAL — Unguarded UIKit APIs (6 issues)

Swift files that use UIKit APIs without `#if os(iOS)` guards, causing macOS Catalyst compilation failures:

1. **SettingsView.swift:226** — `UIApplication.shared.open(url)` bare call in Button action
2. **AuthView.swift:162** — `UIApplication.shared.open(url)` bare call
3. **AuthView.swift:269** — `UIApplication.shared.connectedScenes` in OAuthContextProvider
4. **SecuritySettingsView.swift:283** — `UIWindowScene` cast in startRegistration()
5. **SecuritySettingsView.swift:2** — `import SafariServices` at file scope (iOS-only framework)
6. **SecuritySettingsView.swift:399-404** — SFSafariViewController in UIViewControllerRepresentable, no platform guard

**Fix:** Wrap each in `#if os(iOS)` / `#elseif os(macOS)` blocks. For URL opening, use `NSWorkspace.shared.open(url)` on macOS. For SafariServices, create a separate macOS-specific in-app browser.

---

## HIGH — Info.plist Conflicts (3 issues)

7. **Info.plist:41 / project.yml:44** — `LSRequiresIPhoneOS = true` conflicts with Mac Catalyst identity. Remove or set to false.

8. **Info.plist:55-58 / project.yml:45-46** — Both `UILaunchStoryboardName: LaunchScreen` and `UILaunchScreen: {}` declared. Storyboard excluded from build via project.yml but still referenced. Remove `UILaunchStoryboardName`.

9. **Info.plist:42-43,48-49** — Camera/mic usage descriptions state the app "does not use" these. Apple questions why a terminal app declares camera access. Remove or reword to explain WebRTC P2P dependency properly.

---

## HIGH — Entitlements Gaps (3 issues)

10. **NovoSSH-macOS.entitlements** — Missing `com.apple.security.network.server`. Port forwarding and reverse tunnels require this in App Sandbox.

11. **NovoSSH.entitlements** — Missing `com.apple.security.application-groups`. macOS entitlement declares `group.app.novossh.ios` but iOS does not. Breaks shared Keychain access.

12. **NovoSSH-macOS.entitlements** — Missing `com.apple.security.device.camera` and `com.apple.security.device.audio-input`. Info.plist declares camera/mic descriptions but entitlements don't grant access.

---

## MEDIUM — Privacy & API Reason Codes (4 issues)

13. **PrivacyInfo.xcprivacy:26** — `C617.1` (FileTimestamp) may be wrong. Should be `C617.2` if accessing files user granted via document picker.

14. **PrivacyInfo.xcprivacy:34** — `E174.1` (DiskSpace) may be wrong. `E174.2` is correct for proactive disk-space checks.

15. **PrivacyInfo.xcprivacy:42** — `35F9.1` (SystemBootTime). Verify monotonic clock usage actually matches this declared reason.

16. **PrivacyInfo.xcprivacy** — Potential missing `NSPrivacyAccessedAPICategoryOpenUDID` declaration. WebRTC library historically accesses this. Apple's automated scan will flag it at upload time.

---

## MEDIUM — Project Configuration (3 issues)

17. **project.yml:4-5** — No explicit macOS deployment target. Derived from iOS 17.0, which maps to macOS 14.0 for Catalyst. Verify this is intentional.

18. **iOS entitlements** — Team identifier and application-identifier are hardcoded strings rather than Xcode variables. Inconsistent with macOS entitlements approach.

19. **project.yml:16** — `ENABLE_USER_SCRIPT_SANDBOXING: NO`. Apple tightening this requirement in future Xcode releases.

---

## LOW — Cleanup Items (3 issues)

20. **Info.plist:59-71** — Orientation keys (`UISupportedInterfaceOrientations`) are noise on Catalyst. Harmless but unnecessary.

21. **project.yml:85-86** — Provisioning profile names hardcoded as `"NovoSSH AppStore v2"` and `"NovoSSH MacCatalyst AppStore"`. Fragile.

22. **NovoSSH-macOS.entitlements** — Keychain access group uses `app.novossh.ios` suffix in macOS context. May need macOS-specific group.

---

## Top 3 Actions Before Next Submission

1. Guard all 6 UIKit call sites with `#if os(iOS)` / `#elseif os(macOS)` blocks
2. Remove `UILaunchStoryboardName` from Info.plist and project.yml
3. Add `network.server` to macOS entitlements and `application-groups` to iOS entitlements
