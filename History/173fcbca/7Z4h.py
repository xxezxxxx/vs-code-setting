import os
import uuid
import requests
import streamlit as st

API_BASE = os.getenv("API_BASE", "http://localhost:8000")
BOOT_SECRET = os.getenv("BOOT_SECRET", "dev-secret")


@st.cache_resource
def get_session():
    """공용 requests.Session (헤더 유지)"""
    s = requests.Session()
    s.headers.update({"User-Agent": "hold-lot-viewer-client"})
    return s


def ensure_login():
    """
    - 세션 고유 user_id를 생성/유지
    - 백엔드에 /signal/ready 호출해서 게이트 오픈
    - 성공 시 {ok, user_id, ttl_sec} 반환
    """
    # user_id 유지
    if "user_id" not in st.session_state:
        st.session_state["user_id"] = str(uuid.uuid4())

    session = get_session()
    session.headers.update({"X-User-ID": st.session_state["user_id"]})

    try:
        resp = session.post(
            f"{API_BASE}/signal/ready",
            params={
                "x_key": BOOT_SECRET,
                "user_id": st.session_state["user_id"],
            },
            timeout=5,
        )
        return resp.json() if resp.status_code == 200 else {"ok": False, "error": resp.text}
    except Exception as e:
        return {"ok": False, "error": str(e)}
