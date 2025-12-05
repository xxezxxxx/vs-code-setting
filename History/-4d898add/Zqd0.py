import os
from typing import Any, Dict, List, Optional, Sequence, Union
import streamlit.components.v1 as components

_RELEASE = True

if not _RELEASE:
    _component_func = components.declare_component(
        "my_viewer",
        url="http://localhost:3001",
    )
else:
    parent_dir = os.path.dirname(os.path.abspath(__file__))
    build_dir = os.path.join(parent_dir, "frontend/build")
    _component_func = components.declare_component("my_viewer", path=build_dir)


# ---------------------- util: safe import ----------------------
def _try_imports():
    try:
        import pandas as pd  # type: ignore
    except Exception:
        pd = None  # type: ignore
    try:
        import numpy as np  # type: ignore
    except Exception:
        np = None  # type: ignore
    return pd, np


# ---------------------- util: safe cast ----------------------
def _cast_value(v: Any) -> Any:
    """Cast values to JSON-serializable primitives."""
    pd, np = _try_imports()
    try:
        if v is None:
            return None
        if pd is not None and (v is pd.NaT):  # type: ignore[attr-defined]
            return None
        if np is not None:
            if getattr(np, "isnan", None) is not None:
                try:
                    if np.isnan(v):  # type: ignore[arg-type]
                        return None
                except Exception:
                    pass
            if isinstance(v, getattr(np, "integer", tuple())):
                try:
                    return v.item()
                except Exception:
                    return int(v)
            if isinstance(v, getattr(np, "floating", tuple())):
                try:
                    return v.item()
                except Exception:
                    return float(v)
        if isinstance(v, (bool, int, float, str)):
            return v
        for attr in ("isoformat", "ctime", "__str__"):
            if hasattr(v, attr):
                try:
                    if attr == "isoformat":
                        return getattr(v, attr)()
                except Exception:
                    pass
        return str(v)
    except Exception:
        return str(v)


# ---------------------- util: normalize data ----------------------
def _normalize_table(data: Any) -> Optional[Dict[str, Any]]:
    """Normalize pandas DataFrame/Series or list/dicts into frontend shape."""
    if data is None:
        return None
    pd, _ = _try_imports()

    # DataFrame
    if pd is not None and isinstance(data, pd.DataFrame):  # type: ignore[attr-defined]
        try:
            df = data.copy()
            try:
                df = df.where(df.notna(), None)
            except Exception:
                pass
            records: List[Dict[str, Any]] = df.to_dict(orient="records")  # type: ignore
            records = [{k: _cast_value(v) for k, v in row.items()} for row in records]
            columns = [str(c) for c in list(df.columns)]
            return {"records": records, "columns": columns}
        except Exception:
            pass

    # Series
    if pd is not None and isinstance(data, pd.Series):  # type: ignore[attr-defined]
        try:
            s = data.copy()
            try:
                s = s.where(s.notna(), None)
            except Exception:
                pass
            records = [
                {"index": _cast_value(i), "value": _cast_value(v)} for i, v in s.items()
            ]
            return {"records": records, "columns": ["index", "value"]}
        except Exception:
            pass

    # List[dict]
    if isinstance(data, list) and (len(data) == 0 or isinstance(data[0], dict)):
        records = [{str(k): _cast_value(v) for k, v in row.items()} for row in data]
        columns_set = set()
        for r in records:
            columns_set.update(r.keys())
        return {"records": records, "columns": list(columns_set)}

    # List[primitive]
    if isinstance(data, list):
        records = [{"value": _cast_value(v)} for v in data]
        return {"records": records, "columns": ["value"]}

    # Dict of lists
    if isinstance(data, dict):
        try:
            keys = list(data.keys())
            length = max(
                (len(v) for v in data.values() if isinstance(v, list)), default=0
            )
            recs: List[Dict[str, Any]] = []
            for i in range(length):
                recs.append(
                    {
                        k: _cast_value((data.get(k) or [None] * length)[i])
                        for k in keys
                    }
                )
            return {"records": recs, "columns": keys}
        except Exception:
            pass

    # Fallback
    return {"records": [{"value": _cast_value(data)}], "columns": ["value"]}


# ---------------------- util: layout helpers ----------------------
def _as_int_or_none(x: Any) -> Optional[int]:
    if x is None:
        return None
    try:
        return int(x)
    except Exception:
        return None


def _as_width(x: Any) -> Optional[int | str]:
    if x is None:
        return None
    if isinstance(x, (int, float)):
        return int(x)
    s = str(x).strip()
    return s if s else None


def _as_track_spec(
    x: Union[
        None, str, int, float, Sequence[Union[int, float, str]]
    ],
    *,
    fallback: Optional[str] = None,
    use_fr_for_numbers: bool = True,
) -> Optional[str]:
    """Convert python input to CSS grid track string."""
    if x is None:
        return fallback
    if isinstance(x, str):
        s = x.strip()
        return s or fallback
    if isinstance(x, (int, float)):
        return f"{int(x)}px"
    try:
        seq = list(x)  # type: ignore
    except Exception:
        return fallback
    if len(seq) != 2:
        return fallback
    out: list[str] = []
    for v in seq:
        if isinstance(v, str):
            out.append(v.strip())
        elif isinstance(v, (int, float)):
            if use_fr_for_numbers:
                out.append(f"{v}fr" if v != 0 else "0px")
            else:
                out.append(f"{int(v)}px")
        else:
            out.append(str(v))
    return " ".join(out)


def _validate_column_sizing(x: Optional[str]) -> Optional[str]:
    if x is None:
        return None
    x = str(x).strip().lower()
    if x in {"preset", "content", "auto"}:
        return x
    # fallback to preset if invalid
    return "preset"


# ---------------------- main component function ----------------------
def my_viewer(
    *,
    report_list: Any | None = None,
    report_list_schema: Optional[Dict[str, str]] = None,
    report_detail_html: Optional[str] = None,
    error_log_short: Any | None = None,
    error_log_detail: Any | None = None,
    report_cache: Optional[List[Dict[str, Any]]] = None,
    active_report_index: Optional[int] = None,
    # Behavior controls
    emit_copy_events: Optional[bool] = None,
    emit_shortlog_events: Optional[bool] = None,
    selection_debounce_ms: Optional[int] = None,
    shortlog_debounce_ms: Optional[int] = None,
    filter_config: Optional[Dict[str, Any]] = None,
    search_config: Optional[Dict[str, Any]] = None,
    ui_theme: Optional[Dict[str, Any]] = None,
    auto_emit_initial: Optional[bool] = True,
    shortlog_style_rules: Optional[List[Dict[str, Any]]] = None,
    # Optional alarm/note above the Short Log panel
    shortlog_alarm_note: Optional[Union[str, Dict[str, Any]]] = None,
    report_detail_alarm_note: Optional[Union[str, Dict[str, Any]]] = None,
    # NEW: ShortLog quick jump buttons
    # e.g., {"Go ERROR": {"level": ["ERROR"]}, "Go etc": {"message": "etc"}}
    # Supports special keys: "rowIndex" (original row index), "filteredIndex" (index in current filtered view)
    # Values may be string/int or list of string/int.
    shortlog_jump_buttons: Optional[
        Dict[str, Dict[str, Union[str, int, List[Union[str, int]]]]]
    ] = None,
    # ▼ NEW: ShortLog column layout controls
    shortlog_column_order: Optional[List[str]] = None,
    shortlog_column_sizing: Optional[str] = None,  # "preset" | "content" | "auto"
    # misc
    key: Optional[str] = None,
    default_event: Optional[Dict[str, Any]] = None,
    # ▼ Size props
    max_width: Optional[int | str] = None,
    frame_height: Optional[int] = None,
    list_max_height: Optional[int] = None,
    detail_max_height: Optional[int] = None,
    html_max_height: Optional[int] = None,
    # ▼ Grid ratio/track props
    col_ratio: Optional[List[float] | tuple[float, float]] = None,
    row_ratio: Optional[List[float] | tuple[float, float]] = None,
    grid_columns: Optional[str | List[int | float | str] | tuple[int | float | str, int | float | str]] = None,
    grid_rows: Optional[str | List[int | float | str] | tuple[int | float | str, int | float | str]] = None,
    **kwargs,
) -> Dict[str, Any] | Any:
    """Render the custom 4-panel viewer and return user events."""

    payload: Dict[str, Any] = {
        "report_list": _normalize_table(report_list),
        "report_list_schema": report_list_schema,
        "report_detail_html": report_detail_html,
        "error_log_short": _normalize_table(error_log_short),
        "error_log_detail": _normalize_table(error_log_detail),
        "report_cache": None
        if not report_cache
        else [
            {
                "detail_html": (item.get("detail_html") if isinstance(item, dict) else None),
                "short": _normalize_table((item.get("short") if isinstance(item, dict) else None)),
                "detail": _normalize_table((item.get("detail") if isinstance(item, dict) else None)),
            }
            for item in report_cache
        ],
        "active_report_index": active_report_index,
        "emit_copy_events": emit_copy_events,
        "emit_shortlog_events": emit_shortlog_events,
        "selection_debounce_ms": selection_debounce_ms,
        "shortlog_debounce_ms": shortlog_debounce_ms,
        "filter_config": filter_config,
        "search_config": search_config,
        "ui_theme": ui_theme,
        "auto_emit_initial": auto_emit_initial,
        "shortlog_style_rules": shortlog_style_rules,
        "shortlog_alarm_note": shortlog_alarm_note,
        "report_detail_alarm_note": report_detail_alarm_note,
        "shortlog_jump_buttons": shortlog_jump_buttons,
        # ▼ NEW: pass-through
        "shortlog_column_order": shortlog_column_order,
        "shortlog_column_sizing": _validate_column_sizing(shortlog_column_sizing),
    }

    # Compute shortlog layout (order + width hints)
    try:
        norm = payload.get("error_log_short")
        if isinstance(norm, dict):
            _cols = norm.get("columns") or []
            _rows = norm.get("records") or []
            if isinstance(_cols, list) and isinstance(_rows, list) and _cols:
                cols_list = [str(c) for c in _cols]
                order = cols_list[:]
                if shortlog_column_order:
                    seen = set()
                    merged: List[str] = []
                    for c in shortlog_column_order:
                        if c in order and c not in seen:
                            merged.append(c)
                            seen.add(c)
                    for c in order:
                        if c not in seen:
                            merged.append(c)
                    order = merged
                low = [c.lower() for c in order]
                for i, c in enumerate(low):
                    if c in ("message", "text") and i != len(order) - 1:
                        moved = order.pop(i)
                        order.append(moved)
                        break
                def _width(col: str) -> int:
                    sizing = _validate_column_sizing(shortlog_column_sizing)
                    if sizing in ("auto", "content"):
                        m = len(str(col))
                        for r in _rows:
                            try:
                                s = "" if r.get(col) is None else str(r.get(col))
                            except Exception:
                                s = ""
                            if len(s) > m:
                                m = len(s)
                        return max(80, min(int(m * 8 + 24), 280))
                    cl = col.lower()
                    if cl in ("timestamp", "time", "date", "ts"):
                        return 150
                    if cl == "level":
                        return 100
                    return 140
                layout_cols: List[Dict[str, Any]] = []
                for i, col in enumerate(order):
                    if i == len(order) - 1:
                        layout_cols.append({"name": col, "flex": True})
                    else:
                        layout_cols.append({"name": col, "width_px": _width(col)})
                payload["shortlog_layout"] = {"columns": layout_cols}
    except Exception:
        pass

    # ---- grid controls ----
    grid_cols_str = _as_track_spec(grid_columns, fallback=None, use_fr_for_numbers=True)
    if grid_cols_str is None and col_ratio is not None:
        grid_cols_str = _as_track_spec(col_ratio, fallback=None, use_fr_for_numbers=True)

    grid_rows_str = _as_track_spec(grid_rows, fallback=None, use_fr_for_numbers=True)
    if grid_rows_str is None and row_ratio is not None:
        grid_rows_str = _as_track_spec(row_ratio, fallback=None, use_fr_for_numbers=True)

    component_value = _component_func(
        **payload,
        key=key,
        default=default_event or {"type": "init"},
        max_width=_as_width(max_width),
        frame_height=_as_int_or_none(frame_height),
        list_max_height=_as_int_or_none(list_max_height),
        detail_max_height=_as_int_or_none(detail_max_height),
        html_max_height=_as_int_or_none(html_max_height),
        grid_columns=grid_cols_str,
        grid_rows=grid_rows_str,
        **kwargs,
    )
    return component_value


if __name__ == "__main__":
    # Interactive demo with aligned short/detail logs per report
    import streamlit as st

    st.set_page_config(layout="wide")

    try:
        import pandas as pd
    except Exception:
        pd = None

    # Cache demo data and conversions to keep reruns fast
    if pd is not None:
        @st.cache_data(show_spinner=False)
        def _to_df(obj):
            return pd.DataFrame(obj)

        @st.cache_data(show_spinner=False)
        def _report_list_df(reports: list[dict]):
            return pd.DataFrame([r["report"] for r in reports])
    else:
        def _to_df(obj):
            return obj
        def _report_list_df(reports: list[dict]):
            return [r["report"] for r in reports]

    @st.cache_data(show_spinner=False)
    def _demo_reports() -> list[dict]:
        data: list[dict] = [
            {
                "report": {"name": "Alpha", "date": "2025-01-10", "path1": "/a/b", "path2": "/c/d"},
                "detail_html": """
                    <div style='font-family:Arial'>
                        <style>
                            .hl-red { background:#ffebee; color:#c62828; padding:2px 4px; border-radius:4px; }
                            .hl-blue { background:#e3f2fd; color:#1565c0; padding:2px 4px; border-radius:4px; }
                            .note { color:#555; font-size:13px; }
                        </style>
                        <h3>Alpha Report</h3>
                        <p><b>Summary:</b> Alpha run completed with <span class='hl-red'>warnings</span>.</p>
                        <ul>
                          <li>Init OK</li>
                          <li>Processed <span class='hl-blue'>120</span> items</li>
                          <li><span class='hl-red'>2 warnings</span></li>
                        </ul>
                        <p class='note'>This is a <span class='hl-blue'>demo highlight</span> to preview copy behavior.</p>
                    </div>
                """,
                "short": [
                    {"ts": "10:00:01.1230124210", "level": "INFO", "message": "Start", "line": 1},
                    {"ts": "10:00:05", "level": "INFO", "message": "Loading", "line": 2},
                    {"ts": "10:00:12", "level": "WARN", "message": "Slow network", "line": 3},
                    {"ts": "10:00:20", "level": "INFO", "message": "Done", "line": 4},
                ],
                "detail": [
                    {"ts": "10:00:01", "message": "Start", "full": "Job started by user alpha\ndasds\nasdf\nsdfds\nsdfds\n\ndsfsdd", "line": 1},
                    {"ts": "10:00:05", "message": "Loading", "full": "Loading resources from S3 bucket...", "line": 2},
                    {"ts": "10:00:12", "message": "Slow network", "full": "Download slowed below 1MB/s", "line": 3},
                    {"ts": "10:00:20", "message": "Done", "full": "Job finished in 19s", "line": 4},
                ],
            },
            {
                "report": {"name": "Beta", "date": "2025-01-11", "path1": "/e/f", "path2": "/g/h"},
                "detail_html": """
                    <div style='font-family:Arial'>
                        <style>
                            .hl-red { background:#ffebee; color:#c62828; padding:2px 4px; border-radius:4px; }
                            .hl-blue { background:#e3f2fd; color:#1565c0; padding:2px 4px; border-radius:4px; }
                            .note { color:#555; font-size:13px; }
                        </style>
                        <h3>Beta Report</h3>
                        <p><b>Summary:</b> Beta run failed with <span class='hl-red'>errors</span>.</p>
                        <ul>
                          <li>Init OK</li>
                          <li>Processed <span class='hl-blue'>23</span> items</li>
                          <li><span class='hl-red'>1 error</span></li>
                        </ul>
                        <p class='note'>Highlighted words will remain highlighted when copied.</p>
                    </div>
                """,
                "short": [
                    {"ts": "11:00:01", "level": "INFO", "message": "Start", "line": 1},
                    {"ts": "11:00:04", "level": "ERROR", "message": "DB connect fail", "line": 2},
                    {"ts": "11:00:04", "level": "INFO", "message": "Retrying", "line": 3},
                    {"ts": "11:00:06", "level": "ERROR", "message": "DB connect timeout", "line": 4},
                ],
                "detail": [
                    {"ts": "11:00:01", "message": "Start", "full": "Job started by user beta", "line": 1},
                    {"ts": "11:00:04", "message": "DB connect fail", "full": "psycopg2.OperationalError ...", "line": 2},
                    {"ts": "11:00:04", "message": "Retrying", "full": "Reattempting connection (1/3)", "line": 3},
                    {"ts": "11:00:06", "message": "DB connect timeout", "full": "Connection timed out after 2s", "line": 4},
                ],
            },
        ]
        for i in range(3, 21):
            name = f"Report {i:02d}"
            date = f"2025-01-{10 + (i % 20):02d}"
            short = [
                {
                    "ts": f"{12 + (i % 6):02d}:{(j // 60):02d}:{(j % 60):02d}",
                    "level": ["INFO", "WARN", "ERROR"][j % 3],
                    "message": f"{name} short log line {j}",
                    "line": j,
                }
                for j in range(1, 26)
            ]
            detail = [
                {
                    "ts": s["ts"],
                    "message": s["message"],
                    "full": f"Full detail for {name} line {s['line']}: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod.",
                    "line": s["line"],
                }
                for s in short
            ]
            html = f"""
                <div style='font-family:Arial'>
                    <style>
                        .hl-red {{ background:#ffebee; color:#c62828; padding:2px 4px; border-radius:4px; }}
                        .hl-blue {{ background:#e3f2fd; color:#1565c0; padding:2px 4px; }}
                    </style>
                    <h3>{name}</h3>
                    <p><b>Summary:</b> Demo <span class='hl-blue'>auto-generated</span> report with <span class='hl-red'>highlights</span>.</p>
                </div>
            """
            data.append({
                "report": {"name": name, "date": date, "path1": f"/auto/{i}/x", "path2": f"/auto/{i}/y"},
                "detail_html": html,
                "short": short,
                "detail": detail,
            })
        return data

    def _rerun():
        try:
            st.rerun()
        except Exception:
            try:
                st.experimental_rerun()
            except Exception:
                pass

    st.write("Demo: my_viewer (Report list + Short/Detail sync)")

    reports_data = _demo_reports()
    report_list = _report_list_df(reports_data)

    if "selected_report_idx" not in st.session_state:
        st.session_state["selected_report_idx"] = 0

    sel = int(st.session_state["selected_report_idx"]) if st.session_state.get("selected_report_idx") is not None else 0
    sel = max(0, min(sel, len(reports_data) - 1))
    cur = reports_data[sel]

    short_logs = cur["short"]
    detail_logs = cur["detail"]
    if pd is not None:
        try:
            short_logs = pd.DataFrame(short_logs)
            detail_logs = pd.DataFrame(detail_logs)
        except Exception:
            pass

    event = my_viewer(
        report_list=report_list,
        report_list_schema={
            "name": "name",
            "date": "date",
            "path1": "path1",
            "path2": "path2",
        },
        report_detail_html=cur["detail_html"],
        error_log_short=short_logs,
        error_log_detail=detail_logs,
        active_report_index=sel,
        auto_emit_initial=True,
        emit_copy_events=False,
        emit_shortlog_events=False,
        selection_debounce_ms=0,
        shortlog_debounce_ms=140,
        report_detail_alarm_note={"text": "Demo 알림: Report Detail 상단 노트 예시", "level": "info"},
        shortlog_style_rules=[
            # 기존 level 기반 배지/색상
            {"column": "level", "equals": ["ERROR"], "backgroundColor": "#ffebee", "color": "#c62828", "badge": True},
            {"column": "level", "equals": ["WARN", "WARNING"], "backgroundColor": "#fff8e1", "color": "#f57c00", "badge": True},
            # rowIndex/filteredIndex 데모
            {"column": "rowIndex", "equals": [1, 4, 7], "backgroundColor": "#e8f1fd", "color": "#1565c0"},
            {"column": "filteredIndex", "equals": [0], "backgroundColor": "#f3e5f5", "color": "#6a1b9a"},
        ],
        shortlog_alarm_note={"text": "Demo 알림: Short Log 상단 노트 예시", "level": "error"},
        shortlog_jump_buttons={
            # 기존 텍스트/수준 매칭
            "Go ERROR": {"level": "ERROR"},
            "Go WARN": {"level": ["WARN", "WARNING"]},
            # rowIndex와 filteredIndex로 점프
            "Go rows 1,4,7": {"rowIndex": [1, 4]},
        },
        filter_config={"columns": ["level"]},
        search_config={"columns": ["message"], "placeholder": "Search message..."},
        ui_theme={"accentColor": "#1976d2"},
        # ▼ NEW: column layout controls (프론트 TSX와 매칭)
        shortlog_column_order=["ts", "level", "message"],  # 없애도 됨
        shortlog_column_sizing="preset",                   # "preset" | "content" | "auto"
        key="my_viewer_demo",
    )

    if isinstance(event, dict) and event.get("type") == "report_selected":
        idx = int(event.get("rowIndex", 0))
        if idx != sel:
            st.session_state["selected_report_idx"] = idx
            _rerun() 