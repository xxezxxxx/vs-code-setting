import streamlit as st
import requests
import os
import uuid

API_BASE = os.getenv("API_BASE", "http://localhost:8000")
BOOT_SECRET = os.getenv("BOOT_SECRET", "dev-secret")

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