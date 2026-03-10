"""
============================================================
ocr_script.py — Google Document AI OCR Extraction
============================================================

PURPOSE:
    Receives a file path and MIME type as command-line arguments.
    Sends the file to Google Document AI for OCR extraction.
    Outputs the result as JSON to stdout for the Electron bridge.

USAGE:
    python ocr_script.py --file <path> --mime <type> --env <env_path>

CONFIG:
    All credentials are read from the .env file passed via --env.
    No hardcoded secrets in this file.

OUTPUT FORMAT (stdout):
    {
        "file_name": "invoice.pdf",
        "processed_at": "20260302_163200",
        "ocr_text": "extracted text...",
        "documentai_document": { ... }
    }
============================================================
"""

import argparse
import json
import os
import sys
import time
import socket
import ssl
import io
from datetime import datetime

# Force UTF-8 for stdout and stderr to prevent encoding errors on Windows
if sys.stdout.encoding != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')


# Parse command-line arguments
parser = argparse.ArgumentParser(description='Google Document AI OCR')
parser.add_argument('--file', required=True, help='Path to the file to process')
parser.add_argument('--mime', required=True, help='MIME type of the file')
parser.add_argument('--env', required=True, help='Path to .env file with credentials')
args = parser.parse_args()


def load_env(env_path):
    """
    Load environment variables from a .env file.
    
    Parameters:
        env_path (str): Absolute path to the .env file
    
    Returns:
        dict: Key-value pairs of environment variables
    """
    env_vars = {}
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    except Exception as e:
        print(f"Error loading .env: {e}", file=sys.stderr)
    return env_vars


def retry_with_backoff(func, retries=3, delay=5):
    """
    Retry a function call with exponential backoff.
    Handles network errors, SSL issues, and API timeouts.
    
    Parameters:
        func (callable): Function to execute
        retries (int): Maximum number of retry attempts
        delay (int): Initial delay between retries (doubles each time)
    
    Returns:
        The return value of the function
    
    Raises:
        Exception: If all retries are exhausted
    """
    for i in range(retries):
        try:
            return func()
        except (ssl.SSLError, socket.timeout, Exception) as e:
            if i == retries - 1:
                raise
            print(f"Retry {i+1}/{retries} after error: {e}", file=sys.stderr)
            time.sleep(delay)
            delay *= 2
    raise Exception("Max retries exceeded")


def main():
    """
    Main OCR processing function.
    
    Flow:
        1. Load credentials from .env file
        2. Initialize Google Document AI client
        3. Read the input file
        4. Send to Document AI for processing
        5. Extract text and structured data
        6. Output JSON result to stdout
    """
    # Load configuration
    env = load_env(args.env)
    
    service_account_path = env.get('GOOGLE_SERVICE_ACCOUNT_PATH', '')
    project_id = env.get('GOOGLE_PROJECT_ID', '')
    location = env.get('GOOGLE_LOCATION', '')
    processor_id = env.get('GOOGLE_PROCESSOR_ID', '')
    
    if not all([service_account_path, project_id, location, processor_id]):
        print(json.dumps({
            "file_name": os.path.basename(args.file),
            "processed_at": datetime.now().strftime("%Y%m%d_%H%M%S"),
            "ocr_text": "",
            "documentai_document": {},
            "error": "Missing Google Document AI configuration in .env"
        }))
        sys.exit(1)
    
    # Import Google libraries (only if config is valid)
    from google.oauth2 import service_account
    from google.cloud import documentai
    from google.protobuf.json_format import MessageToDict
    
    # Set network timeout
    socket.setdefaulttimeout(600)
    
    # Initialize credentials
    creds = service_account.Credentials.from_service_account_file(
        service_account_path,
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    
    # Initialize Document AI client
    client_options = {"api_endpoint": f"{location}-documentai.googleapis.com"}
    client = documentai.DocumentProcessorServiceClient(
        credentials=creds,
        client_options=client_options
    )
    
    # Read the input file
    file_name = os.path.basename(args.file)
    with open(args.file, "rb") as f:
        content = f.read()
    
    # Process with Document AI (with retry)
    def process():
        """
        Send file to Google Document AI for OCR processing.
        
        Returns:
            ProcessResponse: Document AI response containing extracted text and entities
        """
        name = client.processor_path(project_id, location, processor_id)
        raw_document = documentai.RawDocument(content=content, mime_type=args.mime)
        request = documentai.ProcessRequest(name=name, raw_document=raw_document)
        return client.process_document(request=request, timeout=400)
    
    result = retry_with_backoff(process)
    document = result.document
    
    # Convert to dictionary (remove 'pages' to keep output clean)
    full_doc_dict = MessageToDict(document._pb, preserving_proto_field_name=True)
    if "pages" in full_doc_dict:
        del full_doc_dict["pages"]
    
    # Build output payload
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    payload = {
        "file_name": file_name,
        "processed_at": timestamp,
        "ocr_text": document.text or "",
        "documentai_document": full_doc_dict,
    }
    
    # Output JSON to stdout (captured by Electron bridge)
    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # Output error as JSON so the bridge can parse it
        print(json.dumps({
            "file_name": os.path.basename(args.file),
            "processed_at": datetime.now().strftime("%Y%m%d_%H%M%S"),
            "ocr_text": "",
            "documentai_document": {},
            "error": str(e)
        }))
        sys.exit(1)
