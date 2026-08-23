#!/usr/bin/env python3
"""Upload NovoSSH AAB to Google Play Console - Internal & Open Testing tracks."""

import json
import sys
import time
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

PACKAGE = "app.novossh.android"
AAB_PATH = Path("/home/akm/NovoSSH/android/app/build/outputs/bundle/release/app-release.aab")
SERVICE_ACCOUNT_PATH = Path("/home/akm/NovoSSH/android/service-account.json")
VERSION_NAME = "1.12.6"
RELEASE_NOTES = [
    {"language": "en-US", "text": "NovoSSH v1.12.6\n\nFixes:\n- Added 16 KB memory page size support for Android 15+\n- Required by Google Play for all apps targeting Android 15+"}
]

SCOPES = ["https://www.googleapis.com/auth/androidpublisher"]


def authenticate():
    creds = service_account.Credentials.from_service_account_file(
        str(SERVICE_ACCOUNT_PATH), scopes=SCOPES
    )
    return build("androidpublisher", "v3", credentials=creds)


def upload_aab(edits, edit_id):
    """Upload the AAB bundle and return the version code."""
    print(f"  Uploading {AAB_PATH.name} ({AAB_PATH.stat().st_size // (1024*1024)} MB)...")
    media = MediaFileUpload(str(AAB_PATH), mimetype="application/octet-stream", resumable=True)

    result = edits.bundles().upload(
        packageName=PACKAGE,
        editId=edit_id,
        media_body=media,
    ).execute()

    version_code = result["versionCode"]
    print(f"  Uploaded! Version code: {version_code}")
    return version_code


def create_internal_release(edits, edit_id, version_code):
    """Create a release on the internal testing track."""
    print("\n[Internal Testing] Creating release...")

    track_body = {
        "releases": [
            {
                "name": f"v{VERSION_NAME} (internal)",
                "versionCodes": [str(version_code)],
                "releaseNotes": RELEASE_NOTES,
                "status": "completed",
            }
        ]
    }

    edits.tracks().update(
        packageName=PACKAGE,
        editId=edit_id,
        track="internal",
        body=track_body,
    ).execute()

    print("  Release created on internal testing track!")


def create_open_testing_release(edits, edit_id, version_code):
    """Create a release on the open testing (beta) track."""
    print("\n[Open Testing / Beta] Creating release...")

    track_body = {
        "releases": [
            {
                "name": f"v{VERSION_NAME} (open testing)",
                "versionCodes": [str(version_code)],
                "releaseNotes": RELEASE_NOTES,
                "status": "completed",
            }
        ]
    }

    edits.tracks().update(
        packageName=PACKAGE,
        editId=edit_id,
        track="beta",
        body=track_body,
    ).execute()

    print("  Release created on open testing (beta) track!")


def commit_edit(edits, edit_id):
    """Commit the edit transaction."""
    print("\nCommitting changes...")
    edits.commit(packageName=PACKAGE, editId=edit_id).execute()
    print("  Changes committed!")


def main():
    if not AAB_PATH.exists():
        print(f"ERROR: AAB not found at {AAB_PATH}")
        print("Run: ./gradlew bundleRelease")
        sys.exit(1)

    print("=== NovoSSH Play Store Upload ===")
    print(f"Package: {PACKAGE}")
    print(f"Version: {VERSION_NAME}")
    print(f"AAB: {AAB_PATH}")
    print()

    # Authenticate
    print("Authenticating with Google Play API...")
    service = authenticate()
    edits = service.edits()

    # Create edit session
    print("Creating edit session...")
    edit = edits.insert(body={}, packageName=PACKAGE).execute()
    edit_id = edit["id"]
    print(f"  Edit ID: {edit_id}")

    try:
        # Upload AAB
        version_code = upload_aab(edits, edit_id)

        # Create releases on both tracks
        create_internal_release(edits, edit_id, version_code)
        create_open_testing_release(edits, edit_id, version_code)

        # Commit
        commit_edit(edits, edit_id)

        print("\n=== SUCCESS ===")
        print(f"Internal Testing: https://play.google.com/console/{PACKAGE}/tracks/internal")
        print(f"Open Testing:     https://play.google.com/console/{PACKAGE}/tracks/beta")
        print(f"\nTesters can install from:")
        print(f"  Internal: https://play.google.com/store/apps/details?id={PACKAGE}&testingprogram=internal")
        print(f"  Beta:     https://play.google.com/store/apps/details?id={PACKAGE}&testingprogram=beta")

    except Exception as e:
        print(f"\nERROR: {e}")
        print("Rolling back edit session...")
        try:
            edits.delete(packageName=PACKAGE, editId=edit_id).execute()
        except Exception:
            pass
        sys.exit(1)


if __name__ == "__main__":
    main()
