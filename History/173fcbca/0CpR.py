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

# 세션 고유 user_id 생성/유지
if "user_id" not in st.session_state:
    st.session_state["user_id"] = str(uuid.uuid4())

session = get_session()
# 보호 라우트용 식별 헤더 항상 부착
session.headers.update({"X-User-ID": st.session_state["user_id"]})

st.title("게이트웨이 해제 데모")
st.caption(f"user_id: `{st.session_state['user_id']}`")

# 🔑 게이트 열기 버튼 (10분 TTL 리셋)
if st.button("서버 준비 신호 보내기"):
    try:
        resp = session.post(
            f"{API_BASE}/signal/ready",
            params={
                "x_key": BOOT_SECRET,
                "user_id": st.session_state["user_id"],  # ← 반드시 포함
            },
            timeout=5,
        )
        st.write(resp.status_code, resp.json())
    except Exception as e:
        st.error(f"에러: {e}")

# 🚪 게이트 열리기 전에는 503 나옴 (미들웨어에서 차단)
if st.button("더하기 API 호출"):
    resp = session.get(f"{API_BASE}/sum", params={"a": 3, "b": 5}, timeout=5)
    if resp.status_code == 200:
        st.success(f"결과: {resp.json()['result']}")
    else:
        st.error(f"실패: {resp.status_code} → {resp.text}")