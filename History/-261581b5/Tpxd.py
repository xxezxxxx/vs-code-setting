import subprocess
import sys
from pathlib import Path

def main():
    root = Path(__file__).resolve().parent

    frontend_home = root / "frontend" / "home.py"
    if not frontend_home.exists():
        print(f"[ERR] Streamlit entry not found: {frontend_home}")
        sys.exit(1)

    backend_main = root / "backend" / "main.py"
    if not backend_main.exists():
        print(f"[ERR] FastAPI entry not found: {backend_main}")
        sys.exit(1)

    # ── FastAPI (uvicorn)
    api_cmd = [
        sys.executable, "-m", "uvicorn",
        "backend.main:app",
        "--host", "127.0.0.1",
        "--port", "8000",
        "--reload",        # 개발 편의용
    ]
    print(f"[INFO] Starting FastAPI: {' '.join(api_cmd)}")
    api_proc = subprocess.Popen(api_cmd)

    # ── Streamlit
    ui_cmd = [
        "streamlit", "run", str(frontend_home),
        "--server.port", "8501",
    ]
    print(f"[INFO] Starting Streamlit: {' '.join(ui_cmd)}")
    ui_proc = subprocess.Popen(ui_cmd)

    try:
        # 두 프로세스가 끝날 때까지 대기
        api_proc.wait()
        ui_proc.wait()
    except KeyboardInterrupt:
        print("\n[INFO] Stopping processes…")
        api_proc.terminate()
        ui_proc.terminate()

if __name__ == "__main__":
    main()
