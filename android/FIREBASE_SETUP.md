# Firebase Setup Guide for NovoSSH Android

## Quick Setup (5 minutes)

### Step 1: Create Firebase Project
1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Name: `novossh-play`
4. Disable Google Analytics (optional)
5. Click "Create project"

### Step 2: Add Android App
1. In Firebase Console, click the Android icon
2. Package name: `app.novossh.android`
3. App nickname: `NovoSSH Terminal`
4. Debug signing certificate SHA-1: (skip for now)
5. Click "Register app"

### Step 3: Download Config
1. Click "Download google-services.json"
2. Replace `android/app/google-services.json` with the downloaded file

### Step 4: Enable Crashlytics
1. In Firebase Console, go to Crashlytics
2. Click "Enable Crashlytics"
3. Follow the setup steps

### Step 5: Enable Analytics
1. In Firebase Console, go to Analytics
2. Click "Enable Google Analytics"
3. Select or create a property

### Step 6: Build and Test
```bash
cd android
./gradlew assembleDebug
```

### Step 7: Verify
1. Install the debug APK on a device
2. Trigger a crash (or use Firebase Crashlytics test function)
3. Check Firebase Console > Crashlytics for the report
4. Check Firebase Console > Analytics for events

## Manual Config (if CLI fails)

If the Firebase CLI doesn't work, create the config manually:

1. Go to https://console.firebase.google.com/
2. Select or create project `novossh-play`
3. Add Android app with package `app.novossh.android`
4. Download `google-services.json`
5. Replace `android/app/google-services.json`

## Environment Variables

The Firebase config is embedded in `google-services.json`. No additional env vars needed.

## Data Safety Declaration

Update Play Console data safety form:
- **Data collected**: Crash logs, Device IDs
- **Data shared**: None
- **Data collection purpose**: App functionality, Analytics
- **Data is encrypted**: Yes (in transit)
- **Users can request deletion**: Yes (via app uninstall)
