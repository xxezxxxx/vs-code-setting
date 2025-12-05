# frontend/home.py
import streamlit as st
import requests
import os

API_BASE = os.getenv("API_BASE", "http://localhost:8000")
BOOT_SECRET = os.getenv("BOOT_SECRET", "dev-secret")

@st.cache_resource
def get_session():
    s = requests.Session()
    s.headers.update({"User-Agent": "streamlit-client"})
    return s

session = get_session()

st.title("게이트웨이 해제 데모")

# 🔑 게이트 열기 버튼
if st.button("서버 준비 신호 보내기"):
    try:
        resp = session.post(f"{API_BASE}/signal/ready", params={"x_key": BOOT_SECRET}, timeout=5)
        st.write(resp.status_code, resp.json())
    except Exception as e:
        st.error(f"에러: {e}")

# 🚪 게이트 열리기 전에는 503 나옴
if st.button("더하기 API 호출"):
    resp = session.get(f"{API_BASE}/sum", params={"a": 3, "b": 5}, timeout=5)
    if resp.status_code == 200:
        st.success(f"결과: {resp.json()['result']}")
    else:
        st.error(f"실패: {resp.status_code} → {resp.text}")
