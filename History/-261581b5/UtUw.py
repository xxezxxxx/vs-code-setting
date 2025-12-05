import os
import sys
import subprocess
import threading
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent
FRONTEND_HOME = ROOT / "frontend" / "home.py"
BACKEND_MAIN = ROOT / "backend" / "main.py"
LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)

def _reader(proc: subprocess.Popen, name: str, logfile: Path):
    """프로세스 stdout을 읽어 콘솔에 [name] 프리픽스로 내보내고 파일에도 기록."""
    with logfile.open("a", encoding="utf-8") as f:
        for line in iter(proc.stdout.readline, b""):
            text = line.decode(errors="replace").rstrip("\n")
            stamp = datetime.now().strftime("%H:%M:%S")
            pretty = f"[{stamp}] [{name}] {text}"
            print(pretty)
            f.write(pretty + "\n")
            f.flush()

def run_split_in_this_console():
    # ── uvicorn
    api_cmd = [
        sys.executable, "-m", "uvicorn",
        "backend.main:app",
        "--host", "127.0.0.1",
        "--port", "8000",
        "--reload",
    ]
    api_proc = subprocess.Popen(
        api_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=str(ROOT),
        text=False,
    )

    # ── streamlit
    ui_cmd = [
        "streamlit", "run", str(FRONTEND_HOME),
        "--server.port", "8501",
    ]
    ui_proc = subprocess.Popen(
        ui_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=str(ROOT),
        text=False,
    )

    # 각각 로그 파일
    t1 = threading.Thread(target=_reader, args=(api_proc, "API", LOG_DIR / "api.log"), daemon=True)
    t2 = threading.Thread(target=_reader, args=(ui_proc, "UI", LOG_DIR / "ui.log"), daemon=True)
    t1.start(); t2.start()

    try:
        rc1 = api_proc.wait()
        rc2 = ui_proc.wait()
        return rc1 or rc2 or 0
    except KeyboardInterrupt:
        api_proc.terminate()
        ui_proc.terminate()
        return 0

def run_new_windows_windows_only():
    """윈도우에서 두 개의 새 콘솔 창으로 분리 실행."""
    # PowerShell Start-Process 사용 (제목 붙여서 창 구분)
    ps = [
        "powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
        # FastAPI 창
        f'Start-Process -WindowStyle Normal -WorkingDirectory "{ROOT}" '
        f'-FilePath "{sys.executable}" -ArgumentList \'-m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload\' '
        f'-Verb RunAs -PassThru | Out-Null; '
        # Streamlit 창
        f'Start-Process -WindowStyle Normal -WorkingDirectory "{ROOT}" '
        f'-FilePath "streamlit" -ArgumentList \'run "{FRONTEND_HOME}" --server.port 8501\' '
        f'-Verb RunAs -PassThru | Out-Null; '
    ]
    subprocess.Popen(ps)
    print("[INFO] 두 개의 새 콘솔 창을 띄웠습니다. (API/UI)")
    print(f"[INFO] 로그 파일: {LOG_DIR / 'api.log'}, {LOG_DIR / 'ui.log'}")
    return 0

def main():
    if not FRONTEND_HOME.exists():
        print(f"[ERR] not found: {FRONTEND_HOME}")
        sys.exit(1)
    if not BACKEND_MAIN.exists():
        print(f"[ERR] not found: {BACKEND_MAIN}")
        sys.exit(1)

    # 아주 간단한 플래그 처리
    new_windows = "--new-windows" in sys.argv

    if new_windows:
        if os.name != "nt":
            print("[ERR] --new-windows 는 Windows에서만 지원합니다.")
            sys.exit(2)
        sys.exit(run_new_windows_windows_only())
    else:
        print("[INFO] 한 콘솔에 프리픽스 구분 출력 + 파일 저장.")
        print(f"[INFO] 로그 파일: {LOG_DIR / 'api.log'}, {LOG_DIR / 'ui.log'}")
        sys.exit(run_split_in_this_console())

if __name__ == "__main__":
    main()
