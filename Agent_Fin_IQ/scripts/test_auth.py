import sys
from google.oauth2 import service_account
from google.auth.transport.requests import Request

def test():
    try:
        path = r'd:\GIT\Fin-IQ\Agent_Fin_IQ\config\google-service-account.json'
        print(f"Testing with absolute path: {path}")
        creds = service_account.Credentials.from_service_account_file(
            path,
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        creds.refresh(Request())
        print(f"Token: {creds.token[:10]}...")
        print("Success: Token generated and refreshed.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test()
