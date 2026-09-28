"""
WaveBakery Unified Runner
Starts both FastAPI backend and Vite frontend with a single command.
Handles clean shutdown on Ctrl+C.

Usage:
  python run.py
"""

import os
import sys
import time
import subprocess
import signal
import threading
import webbrowser
import urllib.request
import urllib.error

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
if not os.path.exists(os.path.join(FRONTEND_DIR, "package.json")):
    FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend", "wavekitchen-sim")

def find_python():
    """Locate the project virtualenv Python or fallback to sys.executable."""
    candidates = [
        os.path.join(BACKEND_DIR, ".signal", "Scripts", "python.exe"),
        os.path.join(BACKEND_DIR, ".signal", "bin", "python"),
        os.path.join(BACKEND_DIR, ".venv", "Scripts", "python.exe"),
        os.path.join(BACKEND_DIR, ".venv", "bin", "python"),
        os.path.join(BACKEND_DIR, "venv", "Scripts", "python.exe"),
        os.path.join(BACKEND_DIR, "venv", "bin", "python"),
        sys.executable,
    ]
    for c in candidates:
        if os.path.isfile(c) and os.access(c, os.X_OK):
            return c
    return sys.executable

def find_npm():
    """Locate npm on Windows or Unix."""
    if sys.platform == "win32":
        return "npm.cmd"
    return "npm"

def relay_output(proc):
    """Copy a child's combined stdout/stderr to this terminal, line by line."""
    assert proc.stdout is not None
    for raw in iter(proc.stdout.readline, b""):
        sys.stdout.write(raw.decode("utf-8", errors="replace"))
        sys.stdout.flush()


def wait_for_backend(timeout=15):
    """Wait until the FastAPI backend reports healthy on /api/health."""
    url = "http://127.0.0.1:8000/api/health"
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=1) as response:
                if response.status == 200:
                    return True
        except (urllib.error.URLError, ConnectionError, OSError):
            time.sleep(0.5)
    return False

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8') # type: ignore
    except Exception:
        pass

def main():
    py_exec = find_python()
    npm_cmd = find_npm()

    for directory in (BACKEND_DIR, FRONTEND_DIR):
        if not os.path.isdir(directory):
            raise FileNotFoundError(f"Project directory not found: {directory}")

    print("=" * 65)
    print("  WAVEBAKERY SIMULATION RUNNER")
    print("=" * 65)
    print(f"  Root:     {ROOT_DIR}")
    print(f"  Python:   {py_exec}")
    print(f"  Node/npm: {npm_cmd}")
    print("-" * 65)

    # 1. Start backend process
    print(">> [1/2] Starting FastAPI Backend on http://127.0.0.1:8000 ...")
    backend_env = os.environ.copy()
    backend_env["PYTHONUNBUFFERED"] = "1"
    
    backend_cmd = [py_exec, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"]
    if sys.platform == "win32":
        # On Windows, uvicorn's --reload restarts its worker by sending
        # CTRL_C_EVENT, which Windows delivers to EVERY process attached to the
        # console — including this runner and npm. Each backend reload (any
        # edit under backend/, or OneDrive touching a file) therefore looked
        # like the user pressing Ctrl+C and shut both servers down. A separate
        # hidden console keeps that event inside the backend; its output is
        # relayed here so the logs still appear in this terminal.
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=BACKEND_DIR,
            env=backend_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        threading.Thread(target=relay_output, args=(backend_proc,), daemon=True).start()
    else:
        backend_proc = subprocess.Popen(backend_cmd, cwd=BACKEND_DIR, env=backend_env)

    # 2. Wait for backend to be ready
    if not wait_for_backend(timeout=12):
        print("[!] Warning: Backend health check timed out, proceeding with frontend...")
    else:
        print("[+] Backend is online at http://127.0.0.1:8000/api/health")

    # 3. Start frontend dev server
    print(">> [2/2] Starting Vite Frontend dev server ...")
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=FRONTEND_DIR,
    )

    # 4. Open game in default browser after short pause
    def open_browser():
        time.sleep(2.5)
        webbrowser.open("http://localhost:5173")

    threading.Thread(target=open_browser, daemon=True).start()

    print("\n" + "=" * 65)
    print("  Both Frontend & Backend are running!")
    print("  * Web Application: http://localhost:5173")
    print("  * Backend REST API: http://127.0.0.1:8000/api/health")
    print("  * Press Ctrl+C at any time to stop both servers.")
    print("=" * 65 + "\n")

    # 5. Handle shutdown cleanly
    try:
        while True:
            time.sleep(0.5)
            # If any process terminated prematurely, break
            if backend_proc.poll() is not None:
                print("\n[!] Backend process exited unexpectedly.")
                break
            if frontend_proc.poll() is not None:
                print("\n[!] Frontend process exited unexpectedly.")
                break
    except KeyboardInterrupt:
        print("\nStopping WaveBakery servers...")
    finally:
        # Terminate frontend
        if frontend_proc.poll() is None:
            try:
                if sys.platform == "win32":
                    subprocess.call(["taskkill", "/F", "/T", "/PID", str(frontend_proc.pid)], stderr=subprocess.DEVNULL)
                else:
                    frontend_proc.terminate()
            except Exception:
                pass
        
        # Terminate backend
        if backend_proc.poll() is None:
            try:
                if sys.platform == "win32":
                    subprocess.call(["taskkill", "/F", "/T", "/PID", str(backend_proc.pid)], stderr=subprocess.DEVNULL)
                else:
                    backend_proc.terminate()
            except Exception:
                pass

        print("WaveBakery stopped cleanly. Goodbye Chef!\n")

if __name__ == "__main__":
    main()
