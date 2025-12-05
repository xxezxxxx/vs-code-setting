import streamlit as st
from utils.login import ensure_login

st.title("게이트웨이 해제 데모")

# 페이지 열자마자 로그인 시도
login_info = ensure_login()

if login_info.get("ok"):
    st.success(f"✅ 로그인 성공 (user_id: {login_info['user_id']}, TTL={login_info['ttl_sec']}s)")
else:
    st.error(f"❌ 로그인 실패: {login_info.get('error')}")
