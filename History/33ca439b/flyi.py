import os
from typing import Any, Dict, List, Optional, Union

import pandas as pd
import numpy as np
import streamlit.components.v1 as components

# -------------------------------------------------------
# DEV/RELEASE 전환
# -------------------------------------------------------
_RELEASE = False
if not _RELEASE:
    _component_func = components.declare_component(
        "log_viewer",
        url="http://localhost:3001",
    )
else:
    parent_dir = os.path.dirname(os.path.abspath(__file__))
    build_dir = os.path.join(parent_dir, "frontend/build")
    _component_func = components.declare_component("log_viewer", path=build_dir)


def _to_records_safe(
    data: Union[pd.DataFrame, List[Dict[str, Any]], Dict[str, List[Any]]]
) -> List[Dict[str, Any]]:
    """
    다양한 입력을 JSON-직렬화 가능한 list[dict] 형태로 통일.
    - NaN/NaT 등은 None으로 치환
    - dict[column -> list] 형태도 records로 변환
    """
    if isinstance(data, pd.DataFrame):
        df = data.replace({np.nan: None})
        for col in df.columns:
            df[col] = df[col].apply(
                lambda x: x.isoformat() if hasattr(x, "isoformat") else x
            )
        return df.to_dict(orient="records")

    if isinstance(data, dict):
        df = pd.DataFrame(data)
        return _to_records_safe(df)

    if isinstance(data, list):
        def _clean(v):
            if isinstance(v, float) and (np.isnan(v)):
                return None
            if hasattr(v, "isoformat"):
                return v.isoformat()
            return v
        cleaned: List[Dict[str, Any]] = []
        for row in data:
            if isinstance(row, dict):
                cleaned.append({k: _clean(v) for k, v in row.items()})
            else:
                cleaned.append({"value": _clean(row)})
        return cleaned

    return [{"value": str(data)}]


def log_viewer(
    dict_log_short: Union[pd.DataFrame, List[Dict[str, Any]], Dict[str, List[Any]]],
    dict_log_detail: Union[pd.DataFrame, List[Dict[str, Any]], Dict[str, List[Any]]],
    left_title: str = "Short Log",
    right_title: str = "Detail",
    height: int = 560,
    initial_index: Optional[int] = 0,
    search_placeholder: str = "검색...",
    # ---- 디자인 / 동작 옵션 ----
    accent_color: str = "#4F8CF7",
    zebra: bool = True,
    density: str = "compact",        # "compact" | "comfortable"
    width: Union[int, str] = "100%", # 예: 980 or "100%"
    filter_columns: Optional[List[str]] = None,  # 예: ["level"]
    highlight_rules: Optional[Dict[str, Dict[str, Any]]] = None,
    key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    좌: short 로그 리스트(검색/클릭/컬럼필터), 우: 선택된 행의 detail 표시
    highlight_rules 예시:
    {
      "error": {"terms": ["DB error","connection error"], "bg": "#FFE9E9", "columns": ["msg"]},
      "warn":  {"terms": ["DB warn","connection warn"],   "bg": "#FFF6D9"}
    }
    반환 예:
    {
      "selected_index": int | None,
      "selected_short": dict | None,
      "selected_detail": dict | None,
      "query": str,
      "active_filters": { "level": ["INFO","WARN"] }
    }
    """
    short_rows = _to_records_safe(dict_log_short)
    detail_rows = _to_records_safe(dict_log_detail)

    if len(short_rows) != len(detail_rows):
        raise ValueError(
            f"[log_viewer] 길이 불일치: short({len(short_rows)}) != detail({len(detail_rows)})"
        )

    safe_initial = None
    if len(short_rows) > 0 and (initial_index is not None) and 0 <= initial_index < len(short_rows):
        safe_initial = initial_index

    default_payload = {
        "selected_index": safe_initial,
        "selected_short": short_rows[safe_initial] if safe_initial is not None else None,
        "selected_detail": detail_rows[safe_initial] if safe_initial is not None else None,
        "query": "",
        "active_filters": {},
    }

    component_value = _component_func(
        short_rows=short_rows,
        detail_rows=detail_rows,
        left_title=left_title,
        right_title=right_title,
        height=height,
        initial_index=safe_initial,
        search_placeholder=search_placeholder,
        accent_color=accent_color,
        zebra=zebra,
        density=density,
        width=width,
        filter_columns=filter_columns or [],
        highlight_rules=highlight_rules or {},
        key=key,
        default=default_payload,
    )
    return component_value


if __name__ == "__main__":
    import streamlit as st

    st.title("log_viewer demo (filters + highlight + width)")

    short = [
        {"time": "2025-09-10 12:00:01", "level": "INFO",  "msg": "Service started"},
        {"time": "2025-09-10 12:03:10", "level": "WARN",  "msg": "DB warn: latency high"},
        {"time": "2025-09-10 12:05:42", "level": "ERROR", "msg": "DB error: connection timeout"},
        {"time": "2025-09-10 12:07:18", "level": "WARN",  "msg": "connection warn: jitter"},
    ]
    detail = [
        {"time": "2025-09-10 12:00:01", "level": "INFO",  "service": "api", "pid": 4182, "msg": "Service started"},
        {"time": "2025-09-10 12:03:10", "level": "WARN",  "service": "api", "pid": 4182, "latency_ms": 912, "msg": "DB warn: latency high"},
        {"time": "2025-09-10 12:05:42", "level": "ERROR", "service": "db",  "pid": 4210, "error": "timeout", "retry": False, "msg": "DB error: connection timeout"},
        {"time": "2025-09-10 12:07:18", "level": "WARN",  "service": "gw",  "pid": 4222, "msg": "connection warn: jitter"},
    ]

    rules = {
        "error": {"terms": ["DB error", "connection error"], "bg": "#FFE9E9", "columns": ["msg"]},
        "warn":  {"terms": ["DB warn",  "connection warn"],  "bg": "#FFF6D9"}  # 모든 컬럼 텍스트에서 검색
    }

    result = log_viewer(
        short, detail,
        left_title="Short",
        right_title="Detail",
        height=560,
        width=980,
        accent_color="#4F8CF7",
        zebra=True,
        density="compact",
        filter_columns=["level"],
        highlight_rules=rules,
        key="logv1",
    )
    st.write("result:", result)
