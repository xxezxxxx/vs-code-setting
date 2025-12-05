from __future__ import annotations

from typing import Dict, List, Optional, TypedDict, Union
import os
import streamlit as st
import streamlit.components.v1 as components
import time

# DEV / RELEASE 스위치
_RELEASE = False

if not _RELEASE:
    _component_func = components.declare_component(
        "sub_menu",
        url="http://localhost:3001",
    )
else:
    _component_func = components.declare_component(
        "sub_menu",
        path=os.path.join(os.path.dirname(__file__), "build"),
    )


class Ack(TypedDict, total=False):
    save_ok: bool


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
    order: Optional[List[str]] = None,         # 전체 목록 + 초기 순서
    checked: Optional[List[str]] = None,       # 미리 체크된 항목
    required: Optional[List[str]] = None,      # 해제 불가 항목
    options: Optional[Dict[str, str]] = None,  # 렌더X, save/close 시 그대로 반환
    alarm_note: str = "",
    list_height: int = 360,
    frame_height: int = 720,
    ack: Optional[Ack] = None,
    key: Optional[str] = None,
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


# 데모 실행
if __name__ == "__main__":
    st.set_page_config(layout="wide")

    if "ack" not in st.session_state:
        st.session_state["ack"] = None

    # 👉 임시 버튼: 눌렀을 때 컴포넌트에 저장 성공 신호 보내기
    if st.button("🔔 저장 성공 신호 보내기 (임시)"):
        st.session_state["ack"] = {"save_ok": True, "ts": time.time()}
        st.rerun()

    result = sub_menu(
        title="Select & Reorder Columns",
        name="demo",
        order=[f"col_{i}" for i in range(1, 11)],
        checked=["col_2", "col_5", "col_7"],
        required=["col_2", "col_7"],                      # 해제 불가
        options={"limit": "1000", "mode": "fast"},        # 렌더X, 그대로 패스스루
        alarm_note="변경 후 반드시 Save를 눌러주세요.",
        list_height=420,
        frame_height=840,
        ack=st.session_state.get("ack"),
        key="my_comp_demo_1",
    )

    if result:
        st.write("Returned:", result)
        if result["event"] == "save":
            st.session_state["ack"] = {"save_ok": True}
        else:
            st.session_state["ack"] = None
