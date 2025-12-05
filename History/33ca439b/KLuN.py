import os
from typing import Any, Dict, List, Optional, Union

import pandas as pd
import numpy as np
import streamlit.components.v1 as components

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
    left_title: str = "Simple Log",
    right_title: str = "Detail Log",
    height: int = 560,
    initial_index: Optional[int] = 0,
    search_placeholder: str = "Search",
    # 디자인/동작 옵션
    accent_color: str = "#4F8CF7",
    zebra: bool = True,
    density: str = "compact",            # "compact" | "comfortable"
    width: Union[int, str] = "100%",
    left_width: Optional[Union[int, str]] = None,
    right_width: Optional[Union[int, str]] = None,
    filter_columns: Optional[List[str]] = None,
    highlight_rules: Optional[Dict[str, Dict[str, Any]]] = None,
    highlight_background: Optional[Dict[str, Dict[str, str]]] = None,
    nav_buttons: bool = False,
    nav_column: str = "Level",
    nav_terms: Optional[Dict[str, str]] = None,
    buttons: Optional[Dict[str, Dict[str, List[str]]]] = None,
    key: Optional[str] = None,
) -> Dict[str, Any]:
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

    # Merge highlight rules with highlight_background mapping (column -> term -> color)
    merged_rules: Dict[str, Dict[str, Any]] = {}
    if highlight_rules:
        merged_rules.update(highlight_rules)
    if highlight_background:
        idx = 0
        for col, mapping in highlight_background.items():
            if isinstance(mapping, dict):
                for term, color in mapping.items():
                    merged_rules[f"hb_{col}_{idx}"] = {
                        "terms": [str(term)],
                        "bg": color,
                        "columns": [col],
                    }
                    idx += 1

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
        left_width=left_width,
        right_width=right_width,
        filter_columns=filter_columns or [],
        highlight_rules=merged_rules,
        nav_buttons=nav_buttons,
        nav_column=nav_column,
        nav_terms=nav_terms or {"warn": "WARN", "error": "ERROR"},
        buttons=buttons,
        key=key,
        default=default_payload,
    )
    return component_value


if __name__ == "__main__":
    import streamlit as st

    st.set_page_config(
    page_title="내 앱",
    layout="wide",  # 👉 넓게 펼치는 옵션
    initial_sidebar_state="expanded"
)

    st.title("log_viewer (Light UI + Expanding Search)")

    short = [
        {"Timestamp": "2024-01-26 10:00:00", "Level": "INFO",  "Message": "System started successfully"},
        {"Timestamp": "2024-01-26 10:05:00", "Level": "WARNING","Message": "Low disk space"},
        {"Timestamp": "2024-01-26 10:10:00", "Level": "ERROR", "Message": "Failed to connect to database"},
        {"Timestamp": "2024-01-26 10:15:00", "Level": "INFO",  "Message": "User logged in"},
        {"Timestamp": "2024-01-26 10:20:00", "Level": "DEBUG", "Message": "Processing request"},
        {"Timestamp": "2024-01-26 10:10:00", "Level": "ERROR", "Message": "Failed to connect to database"},
        {"Timestamp": "2024-01-26 10:10:00", "Level": "ERROR", "Message": "Failed to connect to database"},
        {"Timestamp": "2024-01-26 10:10:00", "Level": "ERROR", "Message": "Failed to connect to database"},
        {"Timestamp": "2024-01-26 10:10:00", "Level": "ERROR", "Message": "Failed to connect to database"},

    ]
    detail = [
        {"Timestamp": "2024-01-26 10:00:00", "Level": "INFO",   "Message": "System started successfully", "Source":"System","User":"-" },
        {"Timestamp": "2024-01-26 10:05:00", "Level": "WARNING","Message": "Low disk space",              "Source":"Disk Monitor","User":"System"},
        {"Timestamp": "2024-01-26 10:10:00", "Level": "ERROR",  "Message": "Failed to connect to database","Source":"DB","User":"System"},
        {"Timestamp": "2024-01-26 10:15:00", "Level": "INFO",   "Message": "User logged in",              "Source":"Web","User":"admin"},
        {"Timestamp": "2024-01-26 10:20:00", "Level": "DEBUG",  "Message": "Processing request",          "Source":"API","User":"-"},
        {"Timestamp": "2024-01-26 10:10:00", "Level": "ERROR",  "Message": "Failed to connect to database","Source":"DB","User":"System"},
        {"Timestamp": "2024-01-26 10:10:00", "Level": "ERROR",  "Message": "Failed to connect to database","Source":"DB","User":"System"},
        {"Timestamp": "2024-01-26 10:10:00", "Level": "ERROR",  "Message": "Failed to connect to database","Source":"DB","User":"System"},
        {"Timestamp": "2024-01-26 10:10:00", "Level": "ERROR",  "Message": "Failed to connect to database","Source":"DB","User":"System"},

    ]

    rules = {
        "warn":  {"terms": ["low disk"], "bg": "rgba(255,211,105,0.18)", "columns": ["Message"]},
        "error": {"terms": ["failed", "database"], "bg": "rgba(255,134,134,0.18)"},
    }

    # New: highlight_background maps column -> { term -> color }
    highlight_bg = {
        "Level": {
            "WARNING": "rgba(255,211,105,0.18)",
            "ERROR": "rgba(255,134,134,0.18)",
        },
        "Message": {
            "logged in": "rgba(91,191,114,0.20)",
        },
    }

    # Dynamic buttons: label -> { column -> [terms] }
    buttons = {
        "Go ERROR": {
            "Level": ["ERROR"],
        },
        "Go warn": {
            "Level": ["WARN", "WARNING"],
        },
    }

    st.write(log_viewer(
        dict_log_short=short,
        dict_log_detail=detail,
        left_title="Simple Log (Demo)",
        right_title="Detail Log (Demo)",
        height=400,
        initial_index=0,
        search_placeholder="Search logs...",
        accent_color="#4F8CF7",
        zebra=True,
        density="compact",
        width="100%",              # or a number like 1200
        left_width=1.2,             # or "700px"
        right_width=1,              # or "1fr"
        filter_columns=["Level", "Message"],
        highlight_rules=rules,      # existing rules still supported
        highlight_background=highlight_bg,  # new background mapping
        nav_buttons=True,
        nav_column="Level",
        nav_terms={"warn": "WARNING", "error": "ERROR"},
        buttons=buttons,
        key="demo",
    ))
