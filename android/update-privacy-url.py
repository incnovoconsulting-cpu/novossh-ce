#!/usr/bin/env python3
"""Update privacy policy URL in Google Play Console."""

from google.oauth2 import service_account
from googleapiclient.discovery import build
from pathlib import Path

PACKAGE = "app.novossh.android"
SERVICE_ACCOUNT_PATH = Path("/home/akm/NovoSSH/android/service-account.json")
PRIVACY_URL = "https://novossh.com/privacy"
SCOPES = ["https://www.googleapis.com/auth/androidpublisher"]

def main():
    creds = service_account.Credentials.from_service_account_file(
        str(SERVICE_ACCOUNT_PATH), scopes=SCOPES
    )
    service = build("androidpublisher", "v3", credentials=creds)
    edits = service.edits()

    print("=== Updating Privacy Policy URL ===")
    print(f"Package: {PACKAGE}")
    print(f"URL: {PRIVACY_URL}")
    print()

    # Create edit session
    edit = edits.insert(body={}, packageName=PACKAGE).execute()
    edit_id = edit["id"]
    print(f"Edit ID: {edit_id}")

    try:
        # Get current listing
        listing = edits.details().get(
            packageName=PACKAGE, editId=edit_id
        ).execute()

        print(f"Current contact email: {listing.get('contactEmail', 'not set')}")
        print(f"Current privacy URL: {listing.get('privacyPolicyUrl', 'not set')}")

        # Update privacy policy URL
        listing["privacyPolicyUrl"] = PRIVACY_URL
        listing["contactEmail"] = "support@novossh.com"
        listing["contactPhone"] = ""
        listing["contactWebsite"] = "https://novossh.com"

        edits.details().update(
            packageName=PACKAGE,
            editId=edit_id,
            body=listing,
        ).execute()

        print(f"\nUpdated privacy policy URL to: {PRIVACY_URL}")
        print(f"Updated contact email to: support@novossh.com")

        # Commit
        edits.commit(packageName=PACKAGE, editId=edit_id).execute()
        print("\nChanges committed!")

    except Exception as e:
        print(f"\nERROR: {e}")
        try:
            edits.delete(packageName=PACKAGE, editId=edit_id).execute()
        except Exception:
            pass

if __name__ == "__main__":
    main()
