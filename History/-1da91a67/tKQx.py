from __future__ import annotations
from typing import Dict, List, Optional, TypedDict, Union, Any
import os, time
import streamlit as st
import streamlit.components.v1 as components

# DEV / RELEASE 스위치
_RELEASE = False

if not _RELEASE:
    _component_func = components.declare_component("sub_menu", url="http://localhost:3001")
else:
    _component_func = components.declare_component(
        "sub_menu",
        path=os.path.join(os.path.dirname(__file__), "build"),
    )

class Ack(TypedDict, total=False):
    save_ok: bool
    ts: float

class SaveAPIConfig(TypedDict, total=False):
    url: str                       # ex) "http://localhost:8000/save"
    method: str                    # "POST" | "PUT" | ...
    headers: Dict[str, str]        # ex) {"Authorization": "Bearer ..."}
    timeoutMs: int                 # ex) 5000
    okCodes: List[int]             # ex) [200, 201, 204]
    successPath: str               # ex) "ok"  (응답 JSON에서 True/False를 찾을 경로, dot path)
    bodyTemplate: Dict[str, Any]   # 바디 템플릿 (아래 설명 참고)
    query: Dict[str, str]          # ?a=1&b=2 같은 쿼리 파라미터

class ReturnPayload(TypedDict):
    event: str           # "save" | "close"
    name: Optional[str]
    checked: List[str]
    order: List[str]
    options: Dict[str, str]
    ts: int

def sub_menu(
    *,
    title: str = "Columns",
    name: Optional[str] = None,
    order: Optional[List[str]] = None,
    checked: Optional[List[str]] = None,
    required: Optional[List[str]] = None,
    options: Optional[Dict[str, str]] = None,
    alarm_note: str = "",
    list_height: int = 360,
    frame_height: int = 720,
    ack: Optional[Ack] = None,
    key: Optional[str] = None,
    # 🔽🔽 새로 추가: UI가 직접 호출할 저장 API 설정
    save_api: Optional[SaveAPIConfig] = None,
    default: Optional[Dict[str, Union[str, int, list, dict]]] = None,
) -> Optional[ReturnPayload]:
    """Streamlit Custom Component Wrapper"""
    frame_height = max(300, min(3000, int(frame_height)))
    list_height = max(120, min(1200, int(list_height)))

    args = {
        "title": title,
        "name": name,
        "order": order or [],
        "checked": checked or [],
        "required": required or [],
        "options": options or {},
        "alarm_note": alarm_note,
        "listHeight": list_height,
        "frameHeight": frame_height,
        "ack": ack or None,
        "saveApi": save_api or None,   # ← 전달
    }

    comp_value = _component_func(args=args, key=key, default=default)

    if comp_value is None:
        return None

    if isinstance(comp_value, dict):
        comp_value.setdefault("event", "")
        comp_value.setdefault("checked", [])
        comp_value.setdefault("order", [])
        comp_value.setdefault("options", {})
        comp_value.setdefault("ts", 0)
        return comp_value  # type: ignore[return-value]

    return None

# ───────────────────────────────
# 데모
if __name__ == "__main__":
    
    st.set_page_config(layout="wide")
    if "user_id" not in st.session_state:
        st.session_state["user_id"] = "demo-user-1234"

    # 파이썬에서 URL/바디 템플릿을 자유롭게 커스텀
    save_cfg: SaveAPIConfig = {
        "url": os.getenv("API_SAVE_URL", "http://localhost:8000/save"),
        "method": "POST",
        "headers": {"Content-Type": "application/json"},
        "timeoutMs": 5000,
        "okCodes": [200, 201, 204],
        "successPath": "ok",  # 응답 JSON의 {"ok": true} 를 성공으로 간주
        # 템플릿 키워드:
        # "$name", "$checked", "$order", "$options", "$ts", "$user_id"
        "bodyTemplate": {
            "name": "$name",
            "checked": "$checked",
            "order": "$order",
            "options": "$options",
            "ts": "$ts",
            "user_id": "$user_id",
            "meta": {"source": "streamlit-component"}
        },
        # 필요 시 쿼리도 추가 가능
        "query": {"x_key": os.getenv("BOOT_SECRET", "dev-secret")},
    }

    st.session_state.setdefault("setting_open", False)

    def toggle_setting():
        # 버튼 클릭 때만 상태를 뒤집음 (rerun에 안전)
        st.session_state["setting_open"] = not st.session_state["setting_open"]

    

    col1, col2 = st.columns([1, 1])

    with col1:
        a = st.multiselect("hi", ["a", "b", "c"], key="ms_hi")  # 위젯 key 부여

    with col2:
        st.button("setting", on_click=toggle_setting)

    st.write(st.session_state.setting_open)

    # 열림 상태일 때만 설정 영역 렌더
    if st.session_state.setting_open:
        result = sub_menu(
            title="settings",
            name="demo",
            order=[f"col_{i}" for i in range(1, 11)],
            checked=["col_2", "col_5", "col_7"],
            required=["col_2", "col_7"],
            options={"limit": "100", "mode": "fast", "test": "abc"},
            alarm_note="변경 후 반드시 Save를 눌러주세요.",
            list_height=420,
            frame_height=720,
            # UI가 직접 FastAPI로 저장하게 만들기
            save_api=save_cfg,
            # ack는 이 케이스에선 옵션(토스트는 UI가 API 응답으로 처리)
            ack=None,
            key="my_comp_demo_1",
            # default 값은 초기 반환값 필요할 때만
            default=None,
        )

        

        if result:
            if result["event"] == "close":
                toggle_setting()
                st.rerun()


