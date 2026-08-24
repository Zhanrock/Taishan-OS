"""
One-time local authorization to mint a Gmail OAuth refresh token.

Run this once on your own machine (never in CI):
  python authorize_gmail.py

It opens a browser for you to sign in and grant read-only Gmail access,
then prints a refresh token. Put that value, plus your OAuth client id/secret,
into the GitHub repo secrets: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET,
GMAIL_REFRESH_TOKEN. Nothing here is written to disk or committed.

Prerequisite: a Google Cloud project with the Gmail API enabled and an
OAuth client of type "Desktop app" — download its client id/secret from
the Google Cloud Console and paste them in when prompted.
"""
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def main() -> None:
    client_id = input("OAuth client ID: ").strip()
    client_secret = input("OAuth client secret: ").strip()

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"],
        }
    }
    flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    creds = flow.run_local_server(port=0)

    print("\nSave these as GitHub repo secrets:")
    print(f"  GMAIL_CLIENT_ID     = {client_id}")
    print(f"  GMAIL_CLIENT_SECRET = {client_secret}")
    print(f"  GMAIL_REFRESH_TOKEN = {creds.refresh_token}")


if __name__ == "__main__":
    main()
