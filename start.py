import os
import subprocess
import sys

def start_server():
    port = os.environ.get("PORT", "8000")
    print(f"Starting Uvicorn on port {port}...")
    sys.stdout.flush()
    
    # Exécuter uvicorn en tant que module Python
    cmd = [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", port]
    
    try:
        subprocess.run(cmd, check=True)
    except Exception as e:
        print(f"Server crashed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    start_server()
