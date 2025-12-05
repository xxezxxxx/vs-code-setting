import streamlit as st
import requests

# 세션은 한 번만 만들고 계속 재사용
@st.cache_resource
def get_session():
    s = requests.Session()
    s.headers.update({"User-Agent": "streamlit-client"})
    return s

session = get_session()
API_BASE = "http://localhost:8000"  # FastAPI 주소

st.title("더하기 예제")

a = st.number_input("첫 번째 숫자", value=1)
b = st.number_input("두 번째 숫자", value=2)

if st.button("더하기"):
    # 같은 Session을 계속 사용 → TCP 연결 재활용
    resp = session.get(f"{API_BASE}/sum", params={"a": a, "b": b}, timeout=5)
    data = resp.json()
    st.success(f"결과: {data['result']}")