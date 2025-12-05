from __future__ import annotations

from typing import Dict, List, Optional, TypedDict, Union
import os
import streamlit as st
import streamlit.components.v1 as components

# DEV 모드(로컬 TS dev server) / Release 모드(build 폴더) 선택
_RELEASE = False  # dev server 쓰면 False, 빌드된 번들 쓰면 True

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
    event: str  # "save" | "close"
    name: Optional[str]
    checked: List[str]
    order: List[str]
    options: Dict[str, str]
    ts: int


def sub_menu(
    *,
    title: str = "Columns",
    name: Optional[str] = None,
    order: Optional[List[str]] = None,     # 전체 목록 + 순서
    checked: Optional[List[str]] = None,   # 미리 체크된 항목
    options: Optional[Dict[str, str]] = None,
    alarm_note: str = "",
    list_height: int = 360,
    frame_height: int = 720,               # iframe 고정 높이(px)
    ack: Optional[Ack] = None,
    key: Optional[str] = None,
    default: Optional[Dict[str, Union[str, int, list, dict]]] = None,
) -> Optional[ReturnPayload]:
    """
    Streamlit Custom Component (UI only)

    - 프레임 고정 높이: frame_height (px)
    - 내부 리스트 스크롤 높이: list_height (px)
    - 입력: order(전체+순서), checked(미리 체크)
    - Save/Close 클릭 시 현재 상태 반환(dict)
    - 저장 성공 토스트: 다음 렌더에 ack={'save_ok': True}를 넘기면 표시
    """
    frame_height = max(300, min(3000, int(frame_height)))
    list_height = max(120, min(1200, int(list_height)))

    args = {
        "title": title,
        "name": name,
        "order": order or [],
        "checked": checked or [],
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


# 데모
if __name__ == "__main__":
    st.set_page_config(layout="wide")
    st.title("sub_menu Demo (Fixed Frame Height)")

    result = sub_menu(
        title="Select & Reorder Columns",
        name="demo",
        order=[f"col_{i}" for i in range(1, 10)],   # 전체 목록 + 순서
        checked=["col_2", "col_5", "col_7"],        # 미리 체크
        options={"limit": "1000", "mode": "fast"},
        alarm_note="변경 후 반드시 Save를 눌러주세요.",
        list_height=480,
        frame_height=900,
        ack=st.session_state.get("ack"),
        key="my_comp",
    )

    if result:
        st.write("Returned:", result)
        if result["event"] == "save":
            st.session_state["ack"] = {"save_ok": True}
        else:
            st.session_state["ack"] = None
