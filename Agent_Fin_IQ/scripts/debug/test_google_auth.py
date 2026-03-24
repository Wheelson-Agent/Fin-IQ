import os
import json
import sys
from google.oauth2 import service_account
from google.cloud import documentai

def test_auth():
    # Load .env manually for speed
    env_path = 'config/.env'
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if '=' in line:
                    k, v = line.strip().split('=', 1)
                    env_vars[k] = v
    
    creds_path = env_vars.get('GOOGLE_SERVICE_ACCOUNT_PATH')
    project_id = env_vars.get('GOOGLE_PROJECT_ID')
    location = env_vars.get('GOOGLE_LOCATION')
    processor_id = env_vars.get('GOOGLE_PROCESSOR_ID')

    print(f"Testing with Project: {project_id}, Location: {location}, Processor: {processor_id}")
    print(f"Credentials path: {creds_path}")

    if not all([creds_path, project_id, location, processor_id]):
        print("Missing required env vars")
        return

    try:
        creds = service_account.Credentials.from_service_account_file(
            creds_path,
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
        client_options = {"api_endpoint": f"{location}-documentai.googleapis.com"}
        client = documentai.DocumentProcessorServiceClient(
            credentials=creds,
            client_options=client_options
        )
        
        name = client.processor_path(project_id, location, processor_id)
        print(f"Processor path: {name}")
        
        # Just try to get the processor details to verify auth
        processor = client.get_processor(name=name)
        print(f"Success! Processor status: {processor.state}")
        
    except Exception as e:
        print(f"\nFAILED: {e}")
        if "401" in str(e):
            print("\nAdvice: The 401 error usually means the service account key is invalid, expired, or the system clock is out of sync.")

if __name__ == "__main__":
    test_auth()
