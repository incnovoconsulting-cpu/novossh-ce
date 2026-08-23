#!/usr/bin/env python3
"""Check NovoSSH release status on Google Play Console tracks."""

from google.oauth2 import service_account
from googleapiclient.discovery import build
from pathlib import Path

PACKAGE = "app.novossh.android"
SERVICE_ACCOUNT_PATH = Path("/home/akm/NovoSSH/android/service-account.json")
SCOPES = ["https://www.googleapis.com/auth/androidpublisher"]


def main():
    creds = service_account.Credentials.from_service_account_file(
        str(SERVICE_ACCOUNT_PATH), scopes=SCOPES
    )
    service = build("androidpublisher", "v3", credentials=creds)
    edits = service.edits()

    # Create a read-only edit session
    edit = edits.insert(body={}, packageName=PACKAGE).execute()
    edit_id = edit["id"]

    tracks_to_check = ["internal", "beta", "alpha", "production"]

    print("=== NovoSSH Release Status ===")
    print(f"Package: {PACKAGE}\n")

    for track_name in tracks_to_check:
        try:
            track = edits.tracks().get(
                packageName=PACKAGE, editId=edit_id, track=track_name
            ).execute()

            releases = track.get("releases", [])
            if not releases:
                print(f"[{track_name.upper()}] No releases")
                continue

            for release in releases:
                status = release.get("status", "unknown")
                name = release.get("name", "unnamed")
                codes = release.get("versionCodes", [])
                country_sets = release.get("countryTargetingOptions", {})
                release_notes = release.get("releaseNotes", [])

                print(f"[{track_name.upper()}]")
                print(f"  Name: {name}")
                print(f"  Status: {status}")
                print(f"  Version Codes: {', '.join(codes)}")
                if release_notes:
                    for note in release_notes:
                        lang = note.get("language", "?")
                        text = note.get("text", "")[:100]
                        print(f"  Notes ({lang}): {text}...")
                print()
        except Exception as e:
            if "404" in str(e):
                print(f"[{track_name.upper()}] Track not found (may not exist)")
            else:
                print(f"[{track_name.upper()}] Error: {e}")
            print()

    # Clean up edit session
    try:
        edits.delete(packageName=PACKAGE, editId=edit_id).execute()
    except Exception:
        pass


if __name__ == "__main__":
    main()
