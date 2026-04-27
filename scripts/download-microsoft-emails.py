#!/usr/bin/env python3
"""
Download all Microsoft/Outlook emails to .eml files for JediRe import.

Usage:
  1. pip install O365
  2. Create an Azure app registration:
     - App type: "Mobile and desktop applications"
     - Redirect URI: https://login.microsoftonline.com/common/oauth2/native/client
     - API permissions: Mail.Read, Mail.ReadWrite (delegated)
  3. Run this script — it will open a browser for auth
  4. .eml files land in ./outlook-export/YYYY-MM-DD-subject.eml
"""

import os
import sys
import json
import time
import base64
from pathlib import Path
from datetime import datetime, timezone

try:
    from O365 import Account, FileSystemTokenBackend, mailbox as mb
except ImportError:
    print("Missing O365. Install: pip install O365")
    sys.exit(1)

OUT_DIR = Path("/mnt/c/Users/Leon/Downloads/outlook-export")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Azure App Credentials ──
CLIENT_ID = "YOUR_CLIENT_ID_HERE"
TENANT_ID = "common"  # personal Microsoft accounts

def sanitize_filename(subject: str, date: datetime) -> str:
    safe = "".join(c if c.isalnum() or c in " -_" else "_" for c in subject or "no_subject")
    return f"{date.strftime('%Y-%m-%d')}-{safe[:80]}.eml"

def build_eml(msg: mb.Message) -> str:
    """Reconstruct a rough .eml (MIME) from a Message object."""
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders

    mime = MIMEMultipart("mixed")
    mime["From"] = msg.sender_address or ""
    mime["To"] = ", ".join(r.address if hasattr(r, "address") else str(r) for r in msg.to or [])
    mime["Cc"] = ", ".join(r.address if hasattr(r, "address") else str(r) for r in msg.cc or []) if msg.cc else ""
    mime["Subject"] = msg.subject or ""
    mime["Date"] = msg.received.strftime("%a, %d %b %Y %H:%M:%S %z") if msg.received else ""
    mime["Message-ID"] = msg.object_id or ""

    if msg.body:
        mime.attach(MIMEText(msg.body, "plain", "utf-8"))

    # Forward attachments
    if msg.attachments:
        for att in msg.attachments:
            try:
                part = MIMEBase("application", "octet-stream")
                if hasattr(att, "content") and att.content:
                    if isinstance(att.content, str):
                        part.set_payload(att.content.encode("utf-8"))
                    else:
                        part.set_payload(att.content)
                    encoders.encode_base64(part)
                    part.add_header("Content-Disposition", "attachment", filename=att.name or "file")
                    mime.attach(part)
            except Exception:
                pass

    return mime.as_string()

def main():
    if CLIENT_ID == "YOUR_CLIENT_ID_HERE":
        print("❌ You need to set CLIENT_ID in the script or via environment.")
        print("   Create an Azure app registration and paste the client ID.")
        print("   Or set: export OUTLOOK_CLIENT_ID=your_client_id")
        sys.exit(1)

    client_id = os.environ.get("OUTLOOK_CLIENT_ID", CLIENT_ID)
    credentials = (client_id, "")

    token_backend = FileSystemTokenBackend(token_filename="o365_token.json")
    account = Account(credentials, auth_method_type="msal", tenant_id=TENANT_ID, token_backend=token_backend)

    if not account.is_authenticated:
        print("🔐 Authenticating...")
        scopes = ["Mail.Read", "Mail.ReadWrite"]
        auth_url, _ = account.con.auth_code_url(scopes)
        print(f"\n1. Open this URL in your browser:\n{auth_url}\n")
        print("2. Sign in and paste the redirect URL here:")
        redirect = input("> ").strip()
        try:
            account.con.request_token(redirect)
        except Exception as e:
            print(f"❌ Auth failed: {e}")
            print("   Make sure your redirect URI matches the Azure app registration.")
            sys.exit(1)

    if not account.is_authenticated:
        print("❌ Authentication failed.")
        sys.exit(1)

    print(f"✅ Authenticated as: {account.connections.get_current_user()}")

    mailbox = account.mailbox()
    inbox = mailbox.inbox_folder()
    print(f"📁 Inbox folder: {inbox.name}")

    # Get all folders recursively
    all_folders = [inbox]
    try:
        child_folders = inbox.get_folders()
        all_folders.extend(child_folders)
        for f in child_folders:
            try:
                all_folders.extend(f.get_folders())
            except:
                pass
    except:
        pass

    # Try getting more folders from mailbox root
    try:
        root_folders = mailbox.get_folders()
        for f in root_folders:
            if f not in all_folders:
                all_folders.append(f)
    except:
        pass

    total_downloaded = 0
    for folder in all_folders:
        folder_name = folder.name.replace("/", "-").replace("\\", "-")
        folder_dir = OUT_DIR / folder_name
        folder_dir.mkdir(parents=True, exist_ok=True)

        existing = set(f.name for f in folder_dir.iterdir() if f.suffix == ".eml")
        print(f"📂 {folder_name} ({len(existing)} existing)")

        try:
            messages = folder.get_messages(limit=5000)  # adjust if you have more
        except Exception as e:
            print(f"   ⚠️ Could not read: {e}")
            continue

        count = 0
        for msg in messages:
            try:
                # Minimal load — we have subject + received from listing
                filename = sanitize_filename(msg.subject, msg.received or datetime.now(timezone.utc))
                filepath = folder_dir / filename

                if filepath.name in existing:
                    continue

                # Full load for body + attachments
                msg.body  # triggers lazy load
                eml_content = build_eml(msg)
                filepath.write_text(eml_content, encoding="utf-8")
                count += 1
                existing.add(filepath.name)
            except Exception as e:
                print(f"   ⚠️ Skipped: {msg.subject or 'unknown'} — {e}")

        if count:
            print(f"   ⬇️ Downloaded {count} new emails in {folder_name}")

        total_downloaded += count

    print(f"\n✅ Done. {total_downloaded} new emails downloaded to {OUT_DIR}")
    print("📤 To import into JediRe, upload the .eml files to the Codex section or email-classification endpoint.")

if __name__ == "__main__":
    main()
