# frontend/home.py
import streamlit as st
import requests
import os
import uuid

API_BASE = os.getenv("API_BASE", "http://localhost:8000")
BOOT_SECRET = os.getenv("BOOT_SECRET", "dev-secret")

@st.cache_resource
def get_session():
    s = requests.Session()
    s.headers.update({"User-Agent": "streamlit-client"})
    return s



st.title("게이트웨이 해제 데모")
st.caption(f"user_id: `{st.session_state['user_id']}`")



# 🚪 게이트 열리기 전에는 503 나옴 (미들웨어에서 차단)
if st.button("더하기 API 호출"):
    resp = session.get(f"{API_BASE}/sum", params={"a": 3, "b": 5}, timeout=5)
    if resp.status_code == 200:
        st.success(f"결과: {resp.json()['result']}")
    else:
        st.error(f"실패: {resp.status_code} → {resp.text}")
