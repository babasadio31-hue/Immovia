import os
import subprocess
import sys
import traceback

def start_server():
    port = int(os.environ.get("PORT", "8000"))
    print(f"Starting Uvicorn on port {port}...")
    sys.stdout.flush()
    
    cmd = [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", str(port)]
    
    try:
        # Lancer Uvicorn. Si tout va bien, ça bloque ici indéfiniment.
        process = subprocess.run(cmd, capture_output=True, text=True)
        # S'il s'arrête tout seul, c'est un crash.
        error_msg = f"Uvicorn s'est arrêté avec le code {process.returncode}.\n\nSortie standard:\n{process.stdout}\n\nErreurs:\n{process.stderr}"
        raise Exception(error_msg)
    except Exception as e:
        print(f"Crash détecté : {e}")
        sys.stdout.flush()
        
        # Lancer un serveur de secours pour afficher l'erreur sur la page web !
        import http.server
        import socketserver
        
        error_text = str(e) + "\n\nTraceback:\n" + traceback.format_exc()
        
        class ErrorHandler(http.server.SimpleHTTPRequestHandler):
            def do_GET(self):
                self.send_response(500)
                self.send_header("Content-type", "text/plain; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(f"LE SERVEUR PYTHON A CRASHÉ !\n\nVoici l'erreur exacte :\n\n{error_text}".encode('utf-8'))
                
        print(f"Démarrage du serveur de secours sur le port {port}...")
        sys.stdout.flush()
        with socketserver.TCPServer(("0.0.0.0", port), ErrorHandler) as httpd:
            httpd.serve_forever()

if __name__ == "__main__":
    start_server()
